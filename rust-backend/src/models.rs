use serde::{Deserialize, Serialize};
use serde_json::Value;

// ข้อมูลขั้นตอนการทำงาน
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacroStep {
    pub id: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub data: Value,
}

// ประเภทการคลิก
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ClickType {
    Left,
    Right,
    Double,
    Middle
}

// ข้อมูลสถานะการทำงาน
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusUpdate {
    pub status: String,
    pub message: String
}

// ข้อมูลการอัปเดตขั้นตอน
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepsUpdate {
    pub steps: Vec<MacroStep>
}

// ข้อมูลตำแหน่งเมาส์
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MousePosition {
    pub x: i32,
    pub y: i32
}

// ข้อมูลขั้นตอนที่กำลังทำงาน
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepExecuting {
    pub index: i32,
    pub current_loop: i32,
    pub total_loops: i32
}

// การตั้งค่าการสุ่มเวลา
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RandomTimingConfig {
    pub enabled: bool,
    pub min_factor: f32,
    pub max_factor: f32
}

// ข้อมูลการทำงานอัตโนมัติ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunAutomationData {
    #[serde(default = "default_loop_count")]
    pub loop_count: i32
}

fn default_loop_count() -> i32 {
    1
}

// ข้อมูลการทำงานเสร็จสิ้น
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationCompleted {
    pub total_loops: i32,
    pub completed_loops: i32
}

// ข้อความ WebSocket
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebSocketMessage {
    #[serde(rename = "status_update")]
    StatusUpdate(StatusUpdate),
    
    #[serde(rename = "steps_updated")]
    StepsUpdate(StepsUpdate),
    
    #[serde(rename = "mouse_position")]
    MousePosition(MousePosition),
    
    #[serde(rename = "step_executing")]
    StepExecuting(StepExecuting),
    
    #[serde(rename = "automation_completed")]
    AutomationCompleted(AutomationCompleted),
    
    #[serde(rename = "recording_started")]
    RecordingStarted,
    
    #[serde(rename = "recording_stopped")]
    RecordingStopped,
    
    #[serde(rename = "random_timing_updated")]
    RandomTimingUpdated(RandomTimingConfig)
} 