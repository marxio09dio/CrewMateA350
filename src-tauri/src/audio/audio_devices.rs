use cpal::traits::{DeviceTrait, HostTrait};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct AudioDevice {
    pub index: String,
    pub name: String,
    pub is_default: bool,
}

#[allow(dead_code)]
pub struct CpalDeviceInfo {
    pub index: String,
    pub name: String,
    pub is_default: bool,
    pub device: cpal::Device,
}

fn get_cpal_host() -> cpal::Host {
    cpal::default_host()
}

pub fn list_input_devices() -> Result<Vec<CpalDeviceInfo>, Box<dyn std::error::Error>> {
    let host = get_cpal_host();
    let default_name = host.default_input_device().and_then(|d| d.name().ok());

    let mut out = Vec::<CpalDeviceInfo>::new();

    for (index, device) in host.input_devices()?.enumerate() {
        let name = device.name().unwrap_or_else(|_| "Unknown".into());
        let is_default = Some(name.clone()) == default_name;
        out.push(CpalDeviceInfo {
            index: index.to_string(),
            name,
            is_default,
            device,
        });
    }

    Ok(out)
}

pub fn list_output_devices() -> Result<Vec<CpalDeviceInfo>, Box<dyn std::error::Error>> {
    let host = get_cpal_host();
    let default_name = host.default_output_device().and_then(|d| d.name().ok());

    let mut out = Vec::<CpalDeviceInfo>::new();

    for (index, device) in host.output_devices()?.enumerate() {
        let name = device.name().unwrap_or_else(|_| "Unknown".into());
        let is_default = Some(name.clone()) == default_name;
        out.push(CpalDeviceInfo {
            index: index.to_string(),
            name,
            is_default,
            device,
        });
    }

    Ok(out)
}

#[tauri::command]
pub fn get_available_input_devices() -> Result<Vec<AudioDevice>, String> {
    let devices =
        list_input_devices().map_err(|e| format!("Failed to list input devices: {}", e))?;

    let mut result = vec![AudioDevice {
        index: "default".to_string(),
        name: "Default".to_string(),
        is_default: true,
    }];

    result.extend(devices.into_iter().map(|d| AudioDevice {
        index: d.index,
        name: d.name,
        is_default: false,
    }));

    Ok(result)
}

#[tauri::command]
pub fn get_available_output_devices() -> Result<Vec<AudioDevice>, String> {
    let devices =
        list_output_devices().map_err(|e| format!("Failed to list output devices: {}", e))?;

    let mut result = vec![AudioDevice {
        index: "default".to_string(),
        name: "Default".to_string(),
        is_default: true,
    }];

    result.extend(devices.into_iter().map(|d| AudioDevice {
        index: d.index,
        name: d.name,
        is_default: false,
    }));

    Ok(result)
}
