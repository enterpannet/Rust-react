use std::sync::Arc;
use tokio::sync::Mutex;
use warp::{http::StatusCode, reply::json, Reply};
use serde_json::json;
use warp::Filter;

use crate::automation::AutomationController;

// Filter สำหรับส่งต่อ automation controller ไปยัง handler
pub fn with_automation(
    automation: Arc<Mutex<AutomationController>>,
) -> impl Filter<Extract = (Arc<Mutex<AutomationController>>,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || automation.clone())
}

// สถานะการทำงานปัจจุบัน
#[allow(dead_code)]
pub async fn get_status(
    automation_controller: Arc<Mutex<AutomationController>>,
) -> Result<impl Reply, warp::Rejection> {
    let controller = automation_controller.lock().await;
    let is_running = controller.is_running;
    let is_recording = controller.is_recording;
    
    let response = json!({
        "is_running": is_running,
        "is_recording": is_recording
    });
    
    Ok(json(&response))
}

// รายการขั้นตอนทั้งหมด
#[allow(dead_code)]
pub async fn get_steps(
    automation_controller: Arc<Mutex<AutomationController>>,
) -> Result<impl Reply, warp::Rejection> {
    let controller = automation_controller.lock().await;
    let steps = controller.steps.clone();
    
    let response = json!({
        "steps": steps
    });
    
    Ok(json(&response))
}

// ตำแหน่งของเมาส์ปัจจุบัน
#[allow(dead_code)]
pub async fn get_mouse_position(
    automation_controller: Arc<Mutex<AutomationController>>,
) -> Result<impl Reply, warp::Rejection> {
    let _controller = automation_controller.lock().await;
    // ให้ใช้ mouse_keyboard::get_cursor_position แทน
    let position = crate::mouse_keyboard::get_cursor_position();
    
    let response = json!({
        "x": position.0,
        "y": position.1
    });
    
    Ok(json(&response))
}

// การตั้งค่าการสุ่มเวลา
#[allow(dead_code)]
pub async fn get_random_timing(
    automation_controller: Arc<Mutex<AutomationController>>,
) -> Result<impl Reply, warp::Rejection> {
    let controller = automation_controller.lock().await;
    let config = crate::models::RandomTimingConfig {
        enabled: controller.random_enabled,
        min_factor: controller.random_min,
        max_factor: controller.random_max,
    };
    
    let response = json!({
        "enabled": config.enabled,
        "min_factor": config.min_factor,
        "max_factor": config.max_factor
    });
    
    Ok(json(&response))
}

// สถานะระบบและเวอร์ชั่น
#[allow(dead_code)]
pub async fn get_system_info() -> Result<impl Reply, warp::Rejection> {
    let response = json!({
        "name": "Mouse and Keyboard Automation",
        "version": "1.0.0",
        "engine": "Rust",
        "os": std::env::consts::OS
    });
    
    Ok(json(&response))
}

// ตรวจสอบว่าเซิร์ฟเวอร์ทำงานอยู่หรือไม่
#[allow(dead_code)]
pub async fn health_check() -> Result<impl Reply, warp::Rejection> {
    Ok(StatusCode::OK)
} 