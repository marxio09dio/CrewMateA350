/// Variable definition sent from the frontend when starting a stream. useSimConnection.ts
#[derive(Debug, Clone, serde::Deserialize)]
pub struct TelemetryVariable {
    pub key: String,
    pub expression: String,
}
