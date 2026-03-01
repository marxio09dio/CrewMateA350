use anyhow::Result;
use log::{debug, info};
use msfs::sim_connect::{client_data_definition, ClientDataArea, SimConnect, SimConnectRecv};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

const DATA_STRING_SIZE: usize = 256;
const MAX_LVARS: usize = 1024;

#[client_data_definition]
#[derive(Clone, Copy)]
struct LVarsArea {
    data: [u32; MAX_LVARS],
}

#[client_data_definition]
#[derive(Clone, Copy)]
struct CommandArea {
    data: [u8; DATA_STRING_SIZE],
}

#[client_data_definition]
#[derive(Clone, Copy)]
struct ResponseArea {
    data: [u8; DATA_STRING_SIZE],
}

#[derive(Debug, Clone)]
struct SimVariable {
    id: u32,
    float_value: Option<f32>,
    initialized: bool,
}

struct SharedState {
    sim_vars: HashMap<u32, SimVariable>,
    sim_var_name_to_id: HashMap<String, u32>,
    last_lvars_data: [u32; MAX_LVARS],
    last_response: [u8; DATA_STRING_SIZE],
}

impl Default for SharedState {
    fn default() -> Self {
        Self {
            sim_vars: HashMap::new(),
            sim_var_name_to_id: HashMap::new(),
            last_lvars_data: [0; MAX_LVARS],
            last_response: [0; DATA_STRING_SIZE],
        }
    }
}

pub struct MobiFlightVariableRequests {
    sim: std::pin::Pin<Box<SimConnect<'static>>>,
    state: Arc<Mutex<SharedState>>,
    command_area: ClientDataArea<CommandArea>,
}

impl MobiFlightVariableRequests {
    pub fn new() -> Result<Self> {
        info!("MobiFlightVariableRequests::new");
        let state = Arc::new(Mutex::new(SharedState::default()));
        let cb_state = Arc::clone(&state);

        let mut sim = SimConnect::open("CrewMate.INIA350", move |sim, recv| {
            if let SimConnectRecv::ClientData(event) = recv {
                if let Some(lvars) = event.into::<LVarsArea>(sim) {
                    if let Ok(mut guard) = cb_state.lock() {
                        let lvars_data = lvars.data;
                        guard.last_lvars_data = lvars_data;

                        for sim_var in guard.sim_vars.values_mut() {
                            let idx = (sim_var.id.saturating_sub(1)) as usize;
                            if idx >= MAX_LVARS {
                                continue;
                            }

                            let float_value = round_5(f32::from_bits(lvars_data[idx]));
                            if !sim_var.initialized && float_value == 0.0 {
                                sim_var.initialized = true;
                            } else {
                                sim_var.float_value = Some(float_value);
                            }
                        }
                    }
                } else if let Some(response) = event.into::<ResponseArea>(sim) {
                    if let Ok(mut guard) = cb_state.lock() {
                        guard.last_response = response.data;
                        debug!(
                            "MobiFlight response: {}",
                            bytes_to_c_string(&guard.last_response)
                        );
                    }
                }
            }
        })?;

        sim.request_client_data::<LVarsArea>(0, "MobiFlight.LVars")?;
        sim.request_client_data::<ResponseArea>(1, "MobiFlight.Response")?;
        let command_area = sim.get_client_area::<CommandArea>("MobiFlight.Command")?;

        Ok(Self {
            sim,
            state,
            command_area,
        })
    }

    pub fn call_dispatch(&mut self) -> Result<()> {
        self.sim.call_dispatch()?;
        Ok(())
    }

    pub fn send_command(&mut self, command: &str) -> Result<()> {
        debug!("send_command: {}", command);
        let mut data = [0u8; DATA_STRING_SIZE];
        let bytes = command.as_bytes();
        let len = bytes.len().min(DATA_STRING_SIZE);
        data[..len].copy_from_slice(&bytes[..len]);
        self.sim
            .set_client_data(&self.command_area, &CommandArea { data })?;
        Ok(())
    }

    pub fn set(&mut self, variable_string: &str) -> Result<()> {
        self.send_command(&format!("MF.SimVars.Set.{variable_string}"))
    }

    /// Non-blocking read: returns the last known value for an already-registered
    /// variable, or `None` if not yet registered / no data received yet.
    pub fn get_cached(&self, variable_string: &str) -> Option<f32> {
        let guard = self.state.lock().ok()?;
        let id = guard.sim_var_name_to_id.get(variable_string)?;
        guard.sim_vars.get(id).and_then(|v| v.float_value)
    }

    pub fn clear_sim_variables(&mut self) -> Result<()> {
        info!("clear_sim_variables");
        if let Ok(mut guard) = self.state.lock() {
            guard.sim_vars.clear();
            guard.sim_var_name_to_id.clear();
        }
        self.send_command("MF.SimVars.Clear")
    }

    pub fn get(&mut self, variable_string: &str) -> Result<Option<f32>> {
        let variable_id = {
            let mut guard = self
                .state
                .lock()
                .map_err(|_| anyhow::anyhow!("state lock poisoned"))?;

            if let Some(id) = guard.sim_var_name_to_id.get(variable_string) {
                *id
            } else {
                let id = guard.sim_vars.len() as u32 + 1;
                guard.sim_vars.insert(
                    id,
                    SimVariable {
                        id,
                        float_value: None,
                        initialized: false,
                    },
                );
                guard
                    .sim_var_name_to_id
                    .insert(variable_string.to_string(), id);
                id
            }
        };

        let should_send_add = if let Ok(guard) = self.state.lock() {
            if let Some(var) = guard.sim_vars.get(&variable_id) {
                var.float_value.is_none() && !var.initialized
            } else {
                false
            }
        } else {
            false
        };

        if should_send_add {
            self.send_command(&format!("MF.SimVars.Add.{variable_string}"))?;
        }

        let mut wait_counter = 0;
        while wait_counter < 50 {
            self.call_dispatch()?;

            let current = {
                let guard = self
                    .state
                    .lock()
                    .map_err(|_| anyhow::anyhow!("state lock poisoned"))?;
                guard.sim_vars.get(&variable_id).and_then(|v| v.float_value)
            };

            if current.is_some() {
                debug!(
                    "get {}. wait_counter={}, return={:?}",
                    variable_string, wait_counter, current
                );
                return Ok(current);
            }

            wait_counter += 1;
            thread::sleep(Duration::from_millis(10));
        }

        let mut guard = self
            .state
            .lock()
            .map_err(|_| anyhow::anyhow!("state lock poisoned"))?;
        let fallback = if let Some(sim_var) = guard.sim_vars.get_mut(&variable_id) {
            if sim_var.float_value.is_none() && sim_var.initialized {
                sim_var.float_value = Some(0.0);
            }
            sim_var.float_value
        } else {
            None
        };

        debug!(
            "get {}. wait_counter={}, return={:?}",
            variable_string, wait_counter, fallback
        );
        Ok(fallback)
    }
}

fn bytes_to_c_string(bytes: &[u8]) -> String {
    let nul_pos = bytes.iter().position(|v| *v == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..nul_pos]).to_string()
}

fn round_5(value: f32) -> f32 {
    (value * 100_000.0).round() / 100_000.0
}
