use crate::models::*;
use std::collections::HashMap;
use tokio::sync::mpsc::UnboundedSender;
use warp::ws::Message;

// ตัวจัดการการทำงานอัตโนมัติ
pub struct AutomationController {
    pub steps: Vec<MacroStep>,
    pub is_running: bool,
    pub is_recording: bool,
    pub random_enabled: bool,
    pub random_min: f32,
    pub random_max: f32,
    pub clients: HashMap<String, UnboundedSender<Message>>,
    pub is_recording_toggle_pending: bool,
}

impl AutomationController {
    pub fn new() -> Self {
        Self {
            steps: Vec::new(),
            is_running: false,
            is_recording: false,
            random_enabled: false,
            random_min: 0.8,
            random_max: 1.2,
            clients: HashMap::new(),
            is_recording_toggle_pending: false,
        }
    }

    // ส่งข้อความไปยังผู้ใช้ทั้งหมด
    #[allow(dead_code)]
    pub fn broadcast_message(&self, message: Message) {
        for (_id, sender) in &self.clients {
            let _ = sender.send(message.clone());
        }
    }
} 