use std::sync::Arc;
use tokio::sync::Mutex;
use warp::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use uuid::Uuid;
use serde_json::{json, Value};
use tokio_stream::wrappers::UnboundedReceiverStream;
use std::error::Error as StdError;
use tokio::time::Duration;
use device_query::{DeviceState, DeviceQuery};

use crate::automation::AutomationController;
// use crate::models::WebSocketMessage;

// จัดการการเชื่อมต่อ WebSocket และเพิ่มผู้ใช้ใหม่ไปยัง AutomationController
pub async fn handle_connection(
    ws: WebSocket,
    automation_controller: Arc<Mutex<AutomationController>>,
) {
    println!("New WebSocket connection");
    
    // สร้าง client ID ใหม่
    let client_id = Uuid::new_v4().to_string();
    
    // แยก WebSocket connection เป็น sender และ receiver
    let (mut ws_tx, mut ws_rx) = ws.split();
    
    // สร้าง mpsc channel สำหรับส่งข้อความไปยัง WebSocket
    let (tx, rx) = mpsc::unbounded_channel();
    let mut rx = UnboundedReceiverStream::new(rx);
    
    // เพิ่ม client ใหม่เข้าไปใน AutomationController
    {
        let mut controller = automation_controller.lock().await;
        controller.clients.insert(client_id.clone(), tx.clone());
    }
    
    // Task สำหรับรับข้อความจาก mpsc channel และส่งไปยัง WebSocket
    tokio::spawn(async move {
        while let Some(message) = rx.next().await {
            if let Err(e) = ws_tx.send(message).await {
                eprintln!("Error sending websocket message: {}", e);
                break;
            }
        }
    });
    
    // รอรับข้อความจาก WebSocket
    while let Some(result) = ws_rx.next().await {
        match result {
            Ok(msg) => {
                // จัดการข้อความที่ได้รับ
                if let Err(e) = handle_websocket_message(msg, automation_controller.clone(), &client_id).await {
                    eprintln!("Error handling websocket message: {}", e);
                }
            }
            Err(e) => {
                eprintln!("Error receiving websocket message: {}", e);
                break;
            }
        }
    }
    
    // ลบ client เมื่อการเชื่อมต่อถูกยกเลิก
    println!("WebSocket connection closed: {}", client_id);
    let mut controller = automation_controller.lock().await;
    controller.clients.remove(&client_id);
}

// จัดการข้อความที่ได้รับจาก WebSocket
async fn handle_websocket_message(
    msg: Message,
    automation_controller: Arc<Mutex<AutomationController>>,
    client_id: &str,
) -> Result<(), Box<dyn StdError>> {
    // ข้ามข้อความ ping/pong
    if msg.is_ping() || msg.is_pong() {
        return Ok(());
    }
    
    // แปลงข้อความเป็น text
    if !msg.is_text() {
        return Ok(());
    }
    
    println!("Received message: {}", msg.to_str().unwrap_or_default());
    
    let text = msg.to_str().map_err(|_| "Failed to convert message to string")?;
    
    // ตรวจสอบว่าเป็น JSON หรือไม่
    if let Ok(json_data) = serde_json::from_str::<Value>(text) {
        let mut controller = automation_controller.lock().await;
        
        // ตรวจสอบว่ามี "command" ก่อน (สำหรับคำสั่งเช่น perform_copy, perform_paste)
        if let Some(command) = json_data.get("command").and_then(|v| v.as_str()) {
            println!("Processing command: {}", command);
            
            match command {
                "perform_copy" => {
                    println!("Performing copy (Ctrl+C)");
                    
                    // อ่านข้อความที่เลือกไว้ก่อน
                    drop(controller); // ปล่อย lock ก่อนเรียกฟังก์ชันที่อาจใช้เวลานาน
                    
                    // 1. เลือกข้อความด้วย Ctrl+A
                    crate::mouse_keyboard::perform_select_all().await;
                    // รอสักครู่
                    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
                    
                    // 2. คัดลอกด้วย Ctrl+C
                    crate::mouse_keyboard::perform_copy().await;
                    // รอสักครู่
                    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
                    
                    // 3. อ่านข้อความจากคลิปบอร์ด
                    let clipboard_text = match crate::mouse_keyboard::get_clipboard_text().await {
                        Ok(text) => {
                            println!("Clipboard text: {}", text);
                            text
                        },
                        Err(err) => {
                            println!("Failed to get clipboard text: {}", err);
                            String::new()
                        }
                    };
                    
                    // ส่งข้อความกลับไปยังไคลเอนต์
                    let response = create_message("action_completed", json!({
                        "action": "copy",
                        "status": "success", 
                        "clipboard_text": clipboard_text
                    }));
                    
                    // ล็อคใหม่เพื่อส่งข้อความกลับ
                    let controller = automation_controller.lock().await;
                    if let Some(client_sender) = controller.clients.get(client_id) {
                        let _ = client_sender.send(response);
                    }
                    return Ok(());
                },
                "perform_paste" => {
                    println!("Performing paste (Ctrl+V)");
                    
                    // ตรวจสอบว่ามีข้อความที่ต้องการวางหรือไม่
                    let custom_text = json_data.get("text").and_then(|v| v.as_str()).map(|s| s.to_string());
                    
                    drop(controller); // ปล่อย lock ก่อนเรียกฟังก์ชันที่อาจใช้เวลานาน
                    
                    // ถ้ามีข้อความที่กำหนด ให้ตั้งค่าคลิปบอร์ดใหม่
                    if let Some(text) = custom_text {
                        match crate::mouse_keyboard::set_clipboard_text(&text).await {
                            Ok(_) => println!("Set clipboard text: {}", text),
                            Err(err) => println!("Failed to set clipboard text: {}", err)
                        }
                        
                        // รอสักครู่
                        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
                    }
                    
                    // วางด้วย Ctrl+V
                    crate::mouse_keyboard::perform_paste().await;
                    
                    // ส่งข้อความยืนยันกลับไปยังไคลเอนต์
                    let response = create_message("action_completed", json!({
                        "action": "paste",
                        "status": "success"
                    }));
                    
                    // ล็อคใหม่เพื่อส่งข้อความกลับ
                    let controller = automation_controller.lock().await;
                    if let Some(client_sender) = controller.clients.get(client_id) {
                        let _ = client_sender.send(response);
                    }
                    return Ok(());
                },
                "get_clipboard" => {
                    println!("Getting clipboard text");
                    drop(controller); // ปล่อย lock ก่อนเรียกฟังก์ชันที่อาจใช้เวลานาน
                    
                    // อ่านข้อความจากคลิปบอร์ด
                    let clipboard_text = match crate::mouse_keyboard::get_clipboard_text().await {
                        Ok(text) => {
                            println!("Clipboard text: {}", text);
                            text
                        },
                        Err(err) => {
                            println!("Failed to get clipboard text: {}", err);
                            String::new()
                        }
                    };
                    
                    // ส่งข้อความกลับไปยังไคลเอนต์
                    let response = create_message("clipboard_text", json!({
                        "text": clipboard_text
                    }));
                    
                    // ล็อคใหม่เพื่อส่งข้อความกลับ
                    let controller = automation_controller.lock().await;
                    if let Some(client_sender) = controller.clients.get(client_id) {
                        let _ = client_sender.send(response);
                    }
                    return Ok(());
                },
                "set_clipboard" => {
                    if let Some(text) = json_data.get("text").and_then(|v| v.as_str()) {
                        println!("Setting clipboard text: {}", text);
                        drop(controller); // ปล่อย lock ก่อนเรียกฟังก์ชันที่อาจใช้เวลานาน
                        
                        // ตั้งค่าข้อความในคลิปบอร์ด
                        let status = match crate::mouse_keyboard::set_clipboard_text(text).await {
                            Ok(_) => {
                                println!("Set clipboard text successfully");
                                "success"
                            },
                            Err(err) => {
                                println!("Failed to set clipboard text: {}", err);
                                "error"
                            }
                        };
                        
                        // ส่งข้อความยืนยันกลับไปยังไคลเอนต์
                        let response = create_message("action_completed", json!({
                            "action": "set_clipboard",
                            "status": status
                        }));
                        
                        // ล็อคใหม่เพื่อส่งข้อความกลับ
                        let controller = automation_controller.lock().await;
                        if let Some(client_sender) = controller.clients.get(client_id) {
                            let _ = client_sender.send(response);
                        }
                    }
                    return Ok(());
                },
                "perform_select_all" => {
                    println!("Performing select all (Ctrl+A)");
                    
                    // ตรวจสอบว่าเพิ่งมีการเริ่ม/หยุดการบันทึกโดยใช้ F7 หรือไม่
                    let is_after_recording_toggle = controller.is_recording_toggle_pending;
                    
                    // ถ้ากำลังมีการใช้ F7 เพื่อควบคุมการบันทึก ให้ข้ามการทำงานนี้
                    if is_after_recording_toggle {
                        println!("Skipping Select All as it was triggered right after F7 recording toggle");
                        controller.is_recording_toggle_pending = false;
                        
                        // ส่งข้อความยืนยันกลับไปยังไคลเอนต์
                        let response = create_message("action_completed", json!({
                            "action": "select_all",
                            "status": "skipped",
                            "message": "Select All skipped because it was triggered by F7 key used for recording"
                        }));
                        
                        if let Some(client_sender) = controller.clients.get(client_id) {
                            let _ = client_sender.send(response);
                        }
                        
                        return Ok(());
                    }
                    
                    drop(controller); // ปล่อย lock ก่อนเรียกฟังก์ชันที่อาจใช้เวลานาน
                    crate::mouse_keyboard::perform_select_all().await;
                    
                    // ส่งข้อความยืนยันกลับไปยังไคลเอนต์
                    let response = create_message("action_completed", json!({
                        "action": "select_all",
                        "status": "success"
                    }));
                    
                    // ล็อคใหม่เพื่อส่งข้อความกลับ
                    let controller = automation_controller.lock().await;
                    if let Some(client_sender) = controller.clients.get(client_id) {
                        let _ = client_sender.send(response);
                    }
                    return Ok(());
                },
                "key_press" => {
                    // รับข้อมูลคีย์ที่จะกด
                    if let Some(key) = json_data.get("key").and_then(|v| v.as_str()) {
                        println!("Manually pressing key: {}", key);
                        drop(controller); // ปล่อย lock ก่อนเรียกฟังก์ชันที่อาจใช้เวลานาน
                        
                        // เรียกใช้ฟังก์ชันกดคีย์บอร์ด
                        let _ = crate::mouse_keyboard::keyboard_press_key(key).await;
                        
                        // ส่งข้อความยืนยันกลับไปยังไคลเอนต์
                        let response = create_message("action_completed", json!({
                            "action": "key_press",
                            "key": key,
                            "status": "success"
                        }));
                        
                        // ล็อคใหม่เพื่อส่งข้อความกลับ
                        let controller = automation_controller.lock().await;
                        if let Some(client_sender) = controller.clients.get(client_id) {
                            let _ = client_sender.send(response);
                        }
                    }
                    return Ok(());
                },
                _ => {
                    println!("Unknown command: {}", command);
                }
            }
            
            return Ok(());
        }
        
        // ดึงประเภทของข้อความ (สำหรับคำสั่งอื่นๆ ที่ใช้ "type")
        let event_type = match json_data.get("type") {
            Some(Value::String(event_type)) => event_type.as_str(),
            _ => {
                println!("Missing or invalid type in message: {}", text);
                return Ok(());
            },
        };
        
        // จัดการประเภทข้อความต่างๆ
        println!("Processing event type: {}", event_type);
        
        match event_type {
            "get_steps" => {
                // ส่งขั้นตอนทั้งหมดกลับไป
                let steps_msg = create_message("steps_updated", json!({ "steps": controller.steps }));
                if let Some(client) = controller.clients.get(client_id) {
                    let _ = client.send(steps_msg);
                    println!("Sent steps to client {}", client_id);
                }
            },
            "get_random_timing" => {
                // ส่งการตั้งค่าการสุ่มเวลา
                let config_msg = create_message("random_timing_updated", json!({
                    "enabled": controller.random_enabled,
                    "min_factor": controller.random_min,
                    "max_factor": controller.random_max
                }));
                if let Some(client) = controller.clients.get(client_id) {
                    let _ = client.send(config_msg);
                    println!("Sent random timing config to client {}", client_id);
                }
            },
            "clear_steps" => {
                // ล้างขั้นตอนทั้งหมด
                controller.steps.clear();
                
                // แจ้งการอัปเดต
                let steps_msg = create_message("steps_updated", json!({ "steps": controller.steps }));
                broadcast_to_clients(&controller.clients, steps_msg);
                println!("Cleared all steps");
            },
            "add_step" => {
                // เพิ่มขั้นตอนใหม่
                if let Some(step_data) = json_data.get("data") {
                    // Try to get step_type first, fallback to type, then use "unknown" as last resort
                    let step_type = step_data.get("step_type")
                        .and_then(|v| v.as_str())
                        .or_else(|| step_data.get("type").and_then(|v| v.as_str()))
                        .unwrap_or("unknown");
                    
                    let new_step = crate::models::MacroStep {
                        id: Uuid::new_v4().to_string(),
                        type_: step_type.to_string(),
                        data: step_data.clone(),
                    };
                    
                    controller.steps.push(new_step);
                    
                    // แจ้งการอัปเดต
                    let steps_msg = create_message("steps_updated", json!({ "steps": controller.steps }));
                    broadcast_to_clients(&controller.clients, steps_msg);
                    println!("Added new step of type {}", step_type);
                }
            },
            "run_automation" => {
                // เริ่มการทำงานอัตโนมัติ
                if let Some(data) = json_data.get("data") {
                    let loop_count = data.get("loop_count").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
                    
                    controller.is_running = true;
                    
                    // แจ้งการอัปเดต
                    let status_msg = create_message("status_update", json!({
                        "status": "running",
                        "message": format!("Running automation with {} loops", loop_count)
                    }));
                    broadcast_to_clients(&controller.clients, status_msg);
                    println!("Started automation with {} loops", loop_count);
                    
                    // ตรวจสอบว่ามีการส่ง steps มาหรือไม่
                    let steps_to_run = if let Some(steps_array) = data.get("steps").and_then(|v| v.as_array()) {
                        // ถ้ามีการส่ง steps มา ให้ใช้ steps ที่ส่งมาแทน
                        println!("Using steps sent from frontend: {} steps", steps_array.len());
                        
                        let mut parsed_steps = Vec::new();
                        for step_value in steps_array {
                            if let (Some(id), Some(type_), Some(data)) = (
                                step_value.get("id").and_then(|v| v.as_str()),
                                step_value.get("type").and_then(|v| v.as_str()),
                                step_value.get("data")
                            ) {
                                let step = crate::models::MacroStep {
                                    id: id.to_string(),
                                    type_: type_.to_string(),
                                    data: data.clone(),
                                };
                                parsed_steps.push(step);
                            }
                        }
                        parsed_steps
                    } else {
                        // ถ้าไม่มี ให้ใช้ steps จาก controller ตามเดิม (เผื่อ backward compatibility)
                        println!("No steps sent from frontend, using stored steps: {} steps", controller.steps.len());
                        controller.steps.clone()
                    };
                    
                    // เรียกใช้ฟังก์ชันทำงานตามขั้นตอน
                    let controller_clone = automation_controller.clone();
                    execute_automation(controller_clone, steps_to_run, loop_count, None).await;
                }
            },
            "run_selected_steps" => {
                // เริ่มการทำงานอัตโนมัติเฉพาะสเต็ปที่เลือก
                if let Some(data) = json_data.get("data") {
                    // ตรวจสอบว่ามีการส่ง steps มาโดยตรงหรือไม่
                    if let Some(steps_array) = data.get("steps").and_then(|v| v.as_array()) {
                        // รับ steps ที่ส่งมาโดยตรง
                        println!("Using steps sent directly from frontend: {} steps", steps_array.len());
                        
                        if !steps_array.is_empty() {
                            controller.is_running = true;
                            
                            // แจ้งการอัปเดต
                            let status_msg = create_message("status_update", json!({
                                "status": "running",
                                "message": format!("Running {} selected steps", steps_array.len())
                            }));
                            broadcast_to_clients(&controller.clients, status_msg);
                            
                            // แปลง steps จาก JSON เป็น MacroStep
                            let mut selected_steps = Vec::new();
                            for step_value in steps_array {
                                if let (Some(id), Some(type_), Some(data)) = (
                                    step_value.get("id").and_then(|v| v.as_str()),
                                    step_value.get("type").and_then(|v| v.as_str()),
                                    step_value.get("data")
                                ) {
                                    let step = crate::models::MacroStep {
                                        id: id.to_string(),
                                        type_: type_.to_string(),
                                        data: data.clone(),
                                    };
                                    selected_steps.push(step);
                                }
                            }
                            
                            // เรียกใช้ฟังก์ชันทำงานตามขั้นตอน
                            let controller_clone = automation_controller.clone();
                            execute_automation(controller_clone, selected_steps, 1, None).await;
                        }
                    } else if let Some(step_ids) = data.get("step_ids").and_then(|v| v.as_array()) {
                        // แบบเดิม - ใช้ step_ids
                        let selected_ids: Vec<String> = step_ids
                            .iter()
                            .filter_map(|id| id.as_str().map(|s| s.to_string()))
                            .collect();
                        
                        println!("Selected step IDs: {:?}", selected_ids);
                        
                        if !selected_ids.is_empty() {
                            controller.is_running = true;
                            
                            // แจ้งการอัปเดต
                            let status_msg = create_message("status_update", json!({
                                "status": "running",
                                "message": format!("Running {} selected steps", selected_ids.len())
                            }));
                            broadcast_to_clients(&controller.clients, status_msg);
                            println!("Started automation with {} selected steps", selected_ids.len());
                            
                            // เรียกใช้ฟังก์ชันทำงานตามขั้นตอน
                            let steps_clone = controller.steps.clone();
                            let controller_clone = automation_controller.clone();
                            execute_automation(controller_clone, steps_clone, 1, Some(selected_ids)).await;
                        }
                    }
                }
            },
            "stop_automation" => {
                // หยุดการทำงานอัตโนมัติ
                controller.is_running = false;
                
                // แจ้งการอัปเดต
                let status_msg = create_message("status_update", json!({
                    "status": "stopped",
                    "message": "Automation stopped"
                }));
                broadcast_to_clients(&controller.clients, status_msg);
                println!("Stopped automation");
            },
            "start_recording" => {
                // เริ่มการบันทึก
                if !controller.is_recording {
                    controller.is_recording = true;
                    // ตั้งค่า flag ว่า F7 ถูกใช้เพื่อเปิดการบันทึก
                    controller.is_recording_toggle_pending = true;
                    
                    // เพิ่มตัวบันทึกเหตุการณ์เมาส์และแป้นพิมพ์
                    let controller_clone = automation_controller.clone();
                    start_event_recorder(controller_clone);
                    
                    // แจ้งการอัปเดต
                    let status_msg = create_message("status_update", json!({
                        "status": "recording",
                        "message": "Recording started - Capturing mouse clicks and keyboard presses"
                    }));
                    broadcast_to_clients(&controller.clients, status_msg);
                    println!("Recording started");
                }
            },
            "stop_recording" => {
                // หยุดการบันทึก
                if controller.is_recording {
                    controller.is_recording = false;
                    // ตั้งค่า flag ว่า F7 ถูกใช้เพื่อปิดการบันทึก
                    controller.is_recording_toggle_pending = true;
                    
                    // แจ้งการอัปเดต
                    let status_msg = create_message("status_update", json!({
                        "status": "idle",
                        "message": "Recording stopped"
                    }));
                    broadcast_to_clients(&controller.clients, status_msg);
                    println!("Recording stopped");
                }
            },
            "toggle_recording" => {
                // จัดการกับคำสั่งเก่าที่อาจยังใช้ toggle_recording
                if !controller.is_recording {
                    // เริ่มการบันทึก
                    controller.is_recording = true;
                    // ตั้งค่า flag ว่า F7 ถูกใช้เพื่อเปิดการบันทึก
                    controller.is_recording_toggle_pending = true;
                    
                    // เพิ่มตัวบันทึกเหตุการณ์เมาส์และแป้นพิมพ์
                    let controller_clone = automation_controller.clone();
                    start_event_recorder(controller_clone);
                    
                    // แจ้งการอัปเดต
                    let status_msg = create_message("status_update", json!({
                        "status": "recording",
                        "message": "Recording started - Capturing mouse clicks and keyboard presses"
                    }));
                    broadcast_to_clients(&controller.clients, status_msg);
                    println!("Recording started (from toggle)");
                } else {
                    // หยุดการบันทึก
                    controller.is_recording = false;
                    // ตั้งค่า flag ว่า F7 ถูกใช้เพื่อปิดการบันทึก
                    controller.is_recording_toggle_pending = true;
                    
                    // แจ้งการอัปเดต
                    let status_msg = create_message("status_update", json!({
                        "status": "idle",
                        "message": "Recording stopped"
                    }));
                    broadcast_to_clients(&controller.clients, status_msg);
                    println!("Recording stopped (from toggle)");
                }
            },
            "update_random_timing" => {
                // อัปเดตการตั้งค่าการสุ่มเวลา
                if let Some(data) = json_data.get("data") {
                    let enabled = data.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
                    let min_factor = data.get("min_factor").and_then(|v| v.as_f64()).unwrap_or(0.8);
                    let max_factor = data.get("max_factor").and_then(|v| v.as_f64()).unwrap_or(1.2);
                    
                    controller.random_enabled = enabled;
                    controller.random_min = min_factor as f32;
                    controller.random_max = max_factor as f32;
                    
                    // แจ้งการอัปเดต
                    let config_msg = create_message("random_timing_updated", json!({
                        "enabled": enabled,
                        "min_factor": min_factor,
                        "max_factor": max_factor
                    }));
                    broadcast_to_clients(&controller.clients, config_msg);
                    println!("Updated random timing: enabled={}, min={}, max={}", enabled, min_factor, max_factor);
                }
            },
            "update_steps_order" => {
                // อัปเดตลำดับของขั้นตอน
                if let Some(data) = json_data.get("data") {
                    if let Some(steps_data) = data.get("steps").and_then(|v| v.as_array()) {
                        // แปลง JSON steps เป็น MacroStep objects
                        let mut new_steps = Vec::new();
                        for step_json in steps_data {
                            if let (Some(id), Some(type_), Some(data)) = (
                                step_json.get("id").and_then(|v| v.as_str()),
                                step_json.get("type").and_then(|v| v.as_str()),
                                step_json.get("data")
                            ) {
                                new_steps.push(crate::models::MacroStep {
                                    id: id.to_string(),
                                    type_: type_.to_string(),
                                    data: data.clone(),
                                });
                            }
                        }
                        
                        // อัปเดตขั้นตอนในคอนโทรลเลอร์
                        controller.steps = new_steps;
                        
                        // แจ้งการอัปเดต
                        let steps_msg = create_message("steps_updated", json!({ "steps": controller.steps }));
                        broadcast_to_clients(&controller.clients, steps_msg);
                        println!("Updated steps order with {} steps", controller.steps.len());
                    }
                }
            },
            _ => {
                println!("Unknown event type: {}", event_type);
            }
        }
    } else {
        println!("Non-JSON message received: {}", text);
    }
    
    Ok(())
}

// สร้างข้อความ WebSocket
pub fn create_message(event_type: &str, data: Value) -> Message {
    let message = json!({
        "type": event_type,
        "data": data
    });
    
    Message::text(message.to_string())
}

// ส่งข้อความไปยังผู้ใช้ทั้งหมด
fn broadcast_to_clients(
    clients: &std::collections::HashMap<String, mpsc::UnboundedSender<Message>>,
    message: Message,
) {
    for (_, client) in clients {
        let _ = client.send(message.clone());
    }
}

// ฟังก์ชันสำหรับการส่งตำแหน่งเมาส์เรียลไทม์
#[allow(dead_code)]
pub fn start_mouse_position_tracking(automation_controller: std::sync::Arc<tokio::sync::Mutex<crate::automation::AutomationController>>) {
    // สร้าง task ใหม่สำหรับการติดตามตำแหน่งเมาส์
    tokio::spawn(async move {
        let mut last_position = (0, 0);

        loop {
            // รอ 50ms ระหว่างการอัพเดทเพื่อลดภาระ CPU
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
            
            // ดึงตำแหน่งเมาส์ปัจจุบัน
            let position = crate::mouse_keyboard::get_cursor_position();
            
            // ส่งตำแหน่งเมาส์เฉพาะเมื่อมีการเปลี่ยนแปลง
            if position != last_position {
                last_position = position;
                
                // สร้างข้อความสำหรับส่ง
                let mouse_msg = create_message("mouse_position", serde_json::json!({
                    "x": position.0,
                    "y": position.1
                }));
                
                // ล็อค automation controller และส่งข้อความไปยังผู้ใช้ทั้งหมด
                if let Ok(controller) = automation_controller.try_lock() {
                    broadcast_to_clients(&controller.clients, mouse_msg);
                }
            }
        }
    });
}

// ฟังก์ชันสำหรับทำงานตามขั้นตอนที่กำหนด
async fn execute_automation(
    controller: Arc<Mutex<AutomationController>>,
    steps: Vec<crate::models::MacroStep>,
    loop_count: i32,
    selected_ids: Option<Vec<String>>,
) {
    println!("Starting execute_automation function");
    // สร้าง task ใหม่เพื่อป้องกันการบล็อค thread
    tokio::spawn(async move {
        // เก็บ clients ไว้เพื่อส่งอัพเดทสถานะ
        let clients_clone = {
            let controller = controller.lock().await;
            controller.clients.clone()
        };
        
        // เก็บ steps ไว้ในตัวแปรใหม่เพื่อใช้หา index
        let steps_for_index = steps.clone();
        
        // กรองเฉพาะขั้นตอนที่เลือก (ถ้ามีการระบุ)
        let filtered_steps = if let Some(ids) = &selected_ids {
            println!("Filtering steps by selected IDs: {:?}", ids);
            steps.iter()
                .filter(|step| ids.contains(&step.id))
                .cloned()
                .collect::<Vec<_>>()
        } else {
            steps
        };
        
        println!("Executing {} steps with {} loops", filtered_steps.len(), loop_count);
        
        for loop_index in 0..loop_count {
            println!("Starting loop {}/{}", loop_index + 1, loop_count);
            
            // เช็คว่ายังทำงานอยู่หรือไม่
            {
                let controller = controller.lock().await;
                if !controller.is_running {
                    println!("Automation stopped");
                    break;
                }
            }
            
            for (step_index, step) in filtered_steps.iter().enumerate() {
                // ส่งสถานะปัจจุบัน
                let current_index = if let Some(_ids) = &selected_ids {
                    // หา index ใน steps เดิม
                    steps_for_index.iter().position(|s| s.id == step.id).unwrap_or(step_index)
                } else {
                    step_index
                };
                
                let step_msg = create_message("step_executing", json!({
                    "index": current_index,
                    "total_steps": filtered_steps.len(),
                    "completed_steps": step_index,
                    "loop_index": loop_index,
                    "total_loops": loop_count
                }));
                broadcast_to_clients(&clients_clone, step_msg);
                
                // เช็คว่ายังทำงานอยู่หรือไม่
                {
                    let controller = controller.lock().await;
                    if !controller.is_running {
                        println!("Automation stopped during execution");
                        break;
                    }
                }
                
                // ทำงานตามประเภทของขั้นตอน
                let step_type = step.type_.as_str();
                println!("Executing step {}: {}", step_index + 1, step_type);
                
                match step_type {
                    "mouse_move" => {
                        // ดึงพิกัด x, y
                        if let (Some(x), Some(y)) = (
                            step.data.get("x").and_then(|v| v.as_i64()),
                            step.data.get("y").and_then(|v| v.as_i64()),
                        ) {
                            println!("Moving mouse to position: ({}, {})", x, y);
                            
                            // เรียกใช้ฟังก์ชันควบคุมเมาส์
                            crate::mouse_keyboard::mouse_move(x as i32, y as i32).await;
                            println!("Mouse move completed");
                        }
                    },
                    "mouse_click" => {
                        // ดึงข้อมูลปุ่มที่คลิก
                        let button_str = step.data.get("button")
                            .and_then(|v| v.as_str())
                            .unwrap_or("left");
                        
                        println!("Clicking {} mouse button", button_str);
                        
                        // แปลงเป็น MouseButton enum
                        let button = match button_str.to_lowercase().as_str() {
                            "right" => crate::mouse_keyboard::MouseButton::Right,
                            "middle" => crate::mouse_keyboard::MouseButton::Middle,
                            _ => crate::mouse_keyboard::MouseButton::Left,
                        };
                        
                        // เรียกใช้ฟังก์ชันคลิกเมาส์
                        crate::mouse_keyboard::mouse_click(button).await;
                        println!("Mouse click completed");
                    },
                    "mouse_double_click" => {
                        // ดึงข้อมูลปุ่มที่คลิก (เหมือน mouse_click)
                        let button_str = step.data.get("button")
                            .and_then(|v| v.as_str())
                            .unwrap_or("left");
                        
                        println!("Double clicking {} mouse button", button_str);
                        
                        // แปลงเป็น MouseButton enum
                        let button = match button_str.to_lowercase().as_str() {
                            "right" => crate::mouse_keyboard::MouseButton::Right,
                            "middle" => crate::mouse_keyboard::MouseButton::Middle,
                            _ => crate::mouse_keyboard::MouseButton::Left,
                        };
                        
                        // เรียกใช้ฟังก์ชันดับเบิลคลิกเมาส์
                        crate::mouse_keyboard::mouse_double_click(button).await;
                        println!("Mouse double click completed");
                    },
                    "key_press" => {
                        // ดึงข้อมูลคีย์ที่จะกด
                        if let Some(key) = step.data.get("key").and_then(|v| v.as_str()) {
                            println!("Pressing key: {}", key);
                            
                            // เรียกใช้ฟังก์ชันกดคีย์บอร์ด
                            let _ = crate::mouse_keyboard::keyboard_press_key(key).await;
                            println!("Key press completed");
                        }
                    },
                    "wait" => {
                        // เป็นขั้นตอนการรอ ไม่ต้องทำอะไรเพิ่มเติม เพราะทุก step มีการรอตามเวลาที่กำหนดอยู่แล้ว
                        println!("Wait step - will continue with normal wait time");
                    },
                    "group" => {
                        // กรณีนี้ไม่ควรเกิดขึ้นเพราะได้แยกขั้นตอนใน group ออกมาตั้งแต่ใน frontend แล้ว
                        println!("Group step encountered - should not happen as groups are processed in frontend");
                    },
                    _ => {
                        println!("Unknown step type: {}", step_type);
                    }
                }
                
                // รอตามเวลาที่กำหนดในขั้นตอน
                let wait_time = step.data.get("wait_time")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(1.0);
                
                let randomize = step.data.get("randomize")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                
                let mut actual_wait = wait_time;
                
                // ปรับเวลารอถ้าเปิดใช้งานการสุ่ม
                if randomize {
                    // ดึงค่าจาก controller
                    let (min_factor, max_factor) = {
                        let controller = controller.lock().await;
                        (controller.random_min as f64, controller.random_max as f64)
                    };
                    
                    use rand::Rng;
                    let mut rng = rand::thread_rng();
                    let factor = min_factor + rng.gen::<f64>() * (max_factor - min_factor);
                    
                    actual_wait *= factor;
                    println!("Randomized wait time: {:.2}s (base: {:.2}s, factor: {:.2})", 
                             actual_wait, wait_time, factor);
                } else {
                    println!("Waiting for {:.2}s", wait_time);
                }
                
                // รอตามเวลาที่คำนวณไว้
                tokio::time::sleep(Duration::from_secs_f64(actual_wait)).await;
            }
        }
        
        // แจ้งว่าการทำงานเสร็จสิ้น
        let complete_msg = create_message("automation_completed", json!({}));
        broadcast_to_clients(&clients_clone, complete_msg);
        
        // รีเซ็ตสถานะการทำงาน
        {
            let mut controller = controller.lock().await;
            controller.is_running = false;
            
            // แจ้งสถานะล่าสุด
            let status_msg = create_message("status_update", json!({
                "status": "idle",
                "message": "Automation completed"
            }));
            broadcast_to_clients(&controller.clients, status_msg);
        }
        
        println!("Automation execution completed");
    });
}

// เพิ่มฟังก์ชันสำหรับบันทึกเหตุการณ์เมาส์และแป้นพิมพ์
fn start_event_recorder(controller: Arc<Mutex<AutomationController>>) {
    // สร้าง thread สำหรับติดตามตำแหน่งเมาส์
    tokio::spawn(async move {
        let device_state = DeviceState::new();
        let mut _last_position = (0, 0); // Prefixed with underscore to indicate intentionally unused
        let mut last_mouse_buttons = vec![false; 10]; // เก็บสถานะปุ่มเมาส์ล่าสุด
        let mut last_keys = device_state.get_keys();
        let mut key_combo_buffer = Vec::new(); // เก็บปุ่มที่กำลังถูกกดพร้อมกัน
        let mut key_combo_timer = std::time::Instant::now(); // จับเวลาการกดปุ่มพร้อมกัน
        let mut mouse_click_cooldown = false; // ป้องกันการบันทึกซ้ำ
        let mut last_click_time = std::time::Instant::now(); // เวลาคลิกล่าสุด
        
        // จับเหตุการณ์ทุก 50 มิลลิวินาที (20 FPS)
        let poll_interval = std::time::Duration::from_millis(50);
        
        // เริ่มด้วยข้อความว่าเริ่มบันทึก
        println!("Event recorder started, tracking mouse clicks and key presses");
        println!("DEBUG: Press each mouse button to see which index it corresponds to");
        
        // เพิ่มฟังก์ชันเพื่อช่วยตรวจสอบ button index
        let mut test_mode_counter = 20; // จำนวนรอบที่จะให้แสดง debug info
        
        loop {
            // เช็คว่ายังอยู่ในโหมดบันทึกหรือไม่
            let is_recording = {
                let controller = controller.lock().await;
                controller.is_recording
            };
            
            if !is_recording {
                println!("Event recorder stopping...");
                break;
            }
            
            // ตรวจสอบตำแหน่งเมาส์
            let current_position = crate::mouse_keyboard::get_cursor_position();
            
            // อัปเดตตำแหน่งเมาส์ล่าสุด (ใช้เพื่อการอ้างอิงในอนาคต)
            _last_position = current_position;
            
            // ตรวจสอบการคลิกเมาส์โดยใช้ device_query
            let mouse_state = device_state.get_mouse();
            
            // Debug mode - แสดงข้อมูลปุ่มเมาส์ทุกครั้งที่มีการกด
            if test_mode_counter > 0 && !mouse_state.button_pressed.is_empty() {
                println!("DEBUG - Mouse button state: {:?}", mouse_state.button_pressed);
                for (i, &pressed) in mouse_state.button_pressed.iter().enumerate() {
                    if pressed {
                        println!("DEBUG - Button at index {} is pressed", i);
                    }
                }
                test_mode_counter -= 1;
            }
            
            // ตรวจสอบ cooldown การคลิก (ป้องกันการบันทึกซ้ำ)
            if mouse_click_cooldown {
                if last_click_time.elapsed().as_millis() > 300 { // รอ 300ms ก่อนจะให้บันทึกการคลิกใหม่ได้
                    mouse_click_cooldown = false;
                } else {
                    // ข้ามการตรวจสอบการคลิกในรอบนี้
                    // อัปเดตสถานะปุ่มเมาส์เพื่อเตรียมพร้อมสำหรับการคลิกถัดไป
                    last_mouse_buttons = vec![false; 10];
                    for (i, &pressed) in mouse_state.button_pressed.iter().enumerate() {
                        if i < last_mouse_buttons.len() {
                            last_mouse_buttons[i] = pressed;
                        }
                    }
                    
                    // ตรวจสอบการกดปุ่มคีย์บอร์ด (ยังคงตรวจสอบปุ่มคีย์บอร์ดตามปกติ)
                    let current_keys = device_state.get_keys();
                    
                    // เพิ่มการตรวจสอบพิเศษสำหรับปุ่ม F7 และปุ่มฟังก์ชันอื่นๆ
                    if !current_keys.is_empty() {
                        // ตรวจสอบว่ามีการกดปุ่มฟังก์ชันหรือไม่
                        let has_function_key = current_keys.iter().any(|k| {
                            matches!(k, 
                                device_query::Keycode::F1 | device_query::Keycode::F2 | 
                                device_query::Keycode::F3 | device_query::Keycode::F4 | 
                                device_query::Keycode::F5 | device_query::Keycode::F6 | 
                                device_query::Keycode::F7 | device_query::Keycode::F8 | 
                                device_query::Keycode::F9 | device_query::Keycode::F10 | 
                                device_query::Keycode::F11 | device_query::Keycode::F12
                            )
                        });
                        
                        // ถ้ามีการกดปุ่มฟังก์ชัน ให้แยกออกมาบันทึกแค่ปุ่มฟังก์ชันเท่านั้น
                        if has_function_key {
                            // แยกเฉพาะปุ่มฟังก์ชัน
                            let function_keys: Vec<_> = current_keys.iter().filter(|k| {
                                matches!(k, 
                                    device_query::Keycode::F1 | device_query::Keycode::F2 | 
                                    device_query::Keycode::F3 | device_query::Keycode::F4 | 
                                    device_query::Keycode::F5 | device_query::Keycode::F6 | 
                                    device_query::Keycode::F7 | device_query::Keycode::F8 | 
                                    device_query::Keycode::F9 | device_query::Keycode::F10 | 
                                    device_query::Keycode::F11 | device_query::Keycode::F12
                                )
                            }).collect();
                            
                            // ถ้ามีปุ่มฟังก์ชันเพียงปุ่มเดียว ให้ข้ามการบันทึก - ปุ่มฟังก์ชันใช้สำหรับควบคุมแอพฯ เท่านั้น
                            if function_keys.len() == 1 {
                                // ไม่บันทึกปุ่มฟังก์ชันเนื่องจากเป็นปุ่มลัดของแอพฯ
                                let key_name = format!("{:?}", function_keys[0]);
                                println!("Skipping recording function key {} as it's used as application shortcut", key_name);
                                
                                // ข้ามการตรวจสอบคีย์คอมโบในรอบนี้
                                last_keys = current_keys;
                                tokio::time::sleep(poll_interval).await;
                                continue;
                            }
                        }
                    }
                }
            }
            
            // ฟังก์ชันช่วยบันทึกตำแหน่งเมาส์และการคลิก
            async fn record_mouse_click(
                controller: &Arc<Mutex<AutomationController>>, 
                position: (i32, i32),
                button: &str
            ) {
                // 1. บันทึกตำแหน่งเมาส์
                let move_data = json!({
                    "type": "mouse_move",
                    "x": position.0,
                    "y": position.1,
                    "wait_time": 0.2,
                    "randomize": false
                });
                
                add_recorded_step(controller, "mouse_move", &move_data).await;
                println!("Recorded: Mouse position ({}, {})", position.0, position.1);
                
                // 2. บันทึกการคลิก
                let click_data = json!({
                    "type": "mouse_click",
                    "button": button,
                    "wait_time": 0.5,
                    "randomize": false
                });
                
                add_recorded_step(controller, "mouse_click", &click_data).await;
                println!("Recorded: {} mouse click at position ({}, {})", button, position.0, position.1);
            }
            
            // ปรับปรุงการตรวจจับการคลิกเมาส์
            let mut button_clicked = false;
            
            // แก้ไขการตรวจจับปุ่มซ้าย - index 1 คือซ้าย (ถูกต้องแล้ว)
            if mouse_state.button_pressed.get(1).map_or(false, |&pressed| pressed) && !last_mouse_buttons[1] {
                record_mouse_click(&controller, current_position, "left").await;
                button_clicked = true;
            }
            
            // แก้ไขการตรวจจับปุ่มขวา - อาจเป็น index 2 ตามที่ผู้ใช้รายงาน
            if !button_clicked && mouse_state.button_pressed.get(2).map_or(false, |&pressed| pressed) && !last_mouse_buttons[2] {
                record_mouse_click(&controller, current_position, "right").await;
                button_clicked = true;
            }
            
            // ตรวจจับปุ่มกลาง - แก้ไขเป็น index 0 หรือ index 3, 4
            if !button_clicked {
                // ลองตรวจสอบหลายตำแหน่งที่อาจเป็นไปได้สำหรับปุ่มกลาง
                if (mouse_state.button_pressed.get(0).map_or(false, |&pressed| pressed) && !last_mouse_buttons[0]) ||
                   (mouse_state.button_pressed.get(3).map_or(false, |&pressed| pressed) && !last_mouse_buttons[3]) ||
                   (mouse_state.button_pressed.get(4).map_or(false, |&pressed| pressed) && !last_mouse_buttons[4]) {
                    
                    // แสดงข้อมูลเพื่อตรวจสอบว่าตำแหน่งใดถูกกด
                    println!("Middle button detected - full button state: {:?}", mouse_state.button_pressed);
                    record_mouse_click(&controller, current_position, "middle").await;
                    button_clicked = true;
                }
            }
            
            if button_clicked {
                mouse_click_cooldown = true;
                last_click_time = std::time::Instant::now();
            }
            
            // บันทึกสถานะเมาส์ล่าสุด
            last_mouse_buttons = vec![false; 10];
            for (i, &pressed) in mouse_state.button_pressed.iter().enumerate() {
                if i < last_mouse_buttons.len() {
                    last_mouse_buttons[i] = pressed;
                }
            }
            
            // ตรวจสอบการกดปุ่มคีย์บอร์ด
            let current_keys = device_state.get_keys();
            
            // เพิ่มการตรวจสอบพิเศษสำหรับปุ่ม F7 และปุ่มฟังก์ชันอื่นๆ
            if !current_keys.is_empty() {
                // ตรวจสอบว่ามีการกดปุ่มฟังก์ชันหรือไม่
                let has_function_key = current_keys.iter().any(|k| {
                    matches!(k, 
                        device_query::Keycode::F1 | device_query::Keycode::F2 | 
                        device_query::Keycode::F3 | device_query::Keycode::F4 | 
                        device_query::Keycode::F5 | device_query::Keycode::F6 | 
                        device_query::Keycode::F7 | device_query::Keycode::F8 | 
                        device_query::Keycode::F9 | device_query::Keycode::F10 | 
                        device_query::Keycode::F11 | device_query::Keycode::F12
                    )
                });
                
                // ถ้ามีการกดปุ่มฟังก์ชัน ให้แยกออกมาบันทึกแค่ปุ่มฟังก์ชันเท่านั้น
                if has_function_key {
                    // แยกเฉพาะปุ่มฟังก์ชัน
                    let function_keys: Vec<_> = current_keys.iter().filter(|k| {
                        matches!(k, 
                            device_query::Keycode::F1 | device_query::Keycode::F2 | 
                            device_query::Keycode::F3 | device_query::Keycode::F4 | 
                            device_query::Keycode::F5 | device_query::Keycode::F6 | 
                            device_query::Keycode::F7 | device_query::Keycode::F8 | 
                            device_query::Keycode::F9 | device_query::Keycode::F10 | 
                            device_query::Keycode::F11 | device_query::Keycode::F12
                        )
                    }).collect();
                    
                    // ถ้ามีปุ่มฟังก์ชันเพียงปุ่มเดียว ให้ข้ามการบันทึก - ปุ่มฟังก์ชันใช้สำหรับควบคุมแอพฯ เท่านั้น
                    if function_keys.len() == 1 {
                        // ไม่บันทึกปุ่มฟังก์ชันเนื่องจากเป็นปุ่มลัดของแอพฯ
                        let key_name = format!("{:?}", function_keys[0]);
                        println!("Skipping recording function key {} as it's used as application shortcut", key_name);
                        
                        // ข้ามการตรวจสอบคีย์คอมโบในรอบนี้
                        last_keys = current_keys;
                        tokio::time::sleep(poll_interval).await;
                        continue;
                    }
                }
            }
            
            // จัดการกับคีย์คอมโบ (2-4 ปุ่ม)
            if !current_keys.is_empty() {
                // ถ้ามีการเพิ่มปุ่มใหม่หรือลดปุ่ม อัปเดตบัฟเฟอร์
                if current_keys.len() != last_keys.len() || !current_keys.iter().all(|k| last_keys.contains(k)) {
                    // ตรวจสอบว่าเป็นการเริ่มกดปุ่มใหม่หรือไม่
                    if last_keys.is_empty() && !current_keys.is_empty() {
                        // เริ่มคอมโบใหม่
                        key_combo_buffer = current_keys.clone();
                        key_combo_timer = std::time::Instant::now();
                    } else if !current_keys.is_empty() {
                        // เพิ่มปุ่มเข้าไปในคอมโบ (ถ้ายังไม่มี)
                        for key in &current_keys {
                            if !key_combo_buffer.contains(key) {
                                key_combo_buffer.push(*key);
                            }
                        }
                        
                        // ถ้าคอมโบมีขนาดระหว่าง 2-4 ปุ่ม และเวลาผ่านไปเพียงพอ (300ms) บันทึกคอมโบ
                        if key_combo_buffer.len() >= 2 && key_combo_buffer.len() <= 4 && 
                           key_combo_timer.elapsed().as_millis() >= 300 && 
                           current_keys.len() < key_combo_buffer.len() {
                            // แปลงปุ่มเป็น string
                            let key_combo = key_combo_buffer.iter()
                                .map(|k| format!("{:?}", k))
                                .collect::<Vec<String>>()
                                .join("+");
                            
                            let step_data = json!({
                                "type": "key_press",
                                "key": key_combo,
                                "wait_time": 0.3,
                                "randomize": false
                            });
                            
                            add_recorded_step(&controller, "key_press", &step_data).await;
                            println!("Recorded: Key combination {}", key_combo);
                            
                            // รีเซ็ตบัฟเฟอร์หลังจากบันทึก
                            key_combo_buffer.clear();
                        }
                    }
                }
            } else if !key_combo_buffer.is_empty() {
                // ปล่อยปุ่มทั้งหมด - ตรวจสอบว่าควรบันทึกคอมโบหรือไม่
                if key_combo_buffer.len() >= 2 && key_combo_buffer.len() <= 4 {
                    // แปลงปุ่มเป็น string และตรวจสอบว่ามีปุ่ม Shift หรือไม่
                    let has_shift = key_combo_buffer.iter().any(|k| matches!(k, device_query::Keycode::LShift | device_query::Keycode::RShift));
                    
                    // แปลงคีย์เป็น lowercase ถ้าไม่มีการกด Shift
                    let key_combo = key_combo_buffer.iter()
                        .map(|k| {
                            let key_str = format!("{:?}", k);
                            if !has_shift && is_letter_key(k) {
                                key_str.to_lowercase()
                            } else {
                                key_str
                            }
                        })
                        .collect::<Vec<String>>()
                        .join("+");
                    
                    let step_data = json!({
                        "type": "key_press",
                        "key": key_combo,
                        "wait_time": 0.3,
                        "randomize": false
                    });
                    
                    add_recorded_step(&controller, "key_press", &step_data).await;
                    println!("Recorded: Key combination {}", key_combo);
                } else if key_combo_buffer.len() == 1 {
                    // บันทึกการกดปุ่มเดี่ยว
                    let key = key_combo_buffer[0];
                    let key_str = format!("{:?}", key);
                    
                    // ตรวจสอบว่าเป็นตัวอักษรหรือไม่ และทำให้เป็นตัวพิมพ์เล็กเสมอ
                    let lowercase_key = if is_letter_key(&key) {
                        key_str.to_lowercase()
                    } else {
                        key_str
                    };
                    
                    let step_data = json!({
                        "type": "key_press",
                        "key": lowercase_key,
                        "wait_time": 0.3,
                        "randomize": false
                    });
                    
                    add_recorded_step(&controller, "key_press", &step_data).await;
                    println!("Recorded: Key press {} (as lowercase)", lowercase_key);
                }
                
                // รีเซ็ตบัฟเฟอร์
                key_combo_buffer.clear();
            }
            
            // บันทึกปุ่มที่กดล่าสุด
            last_keys = current_keys;
            
            // รอก่อนตรวจสอบอีกครั้ง
            tokio::time::sleep(poll_interval).await;
        }
    });
}

// ฟังก์ชันช่วยในการเพิ่มขั้นตอนที่บันทึกได้
async fn add_recorded_step(controller: &Arc<Mutex<AutomationController>>, step_type: &str, data: &serde_json::Value) {
    // สร้าง ID สำหรับขั้นตอนใหม่
    let step_id = Uuid::new_v4().to_string();
    
    // สร้าง MacroStep ใหม่
    let new_step = crate::models::MacroStep {
        id: step_id,
        type_: step_type.to_string(),
        data: data.clone(),
    };
    
    // เพิ่มขั้นตอนเข้าไปใน controller
    {
        let mut controller = controller.lock().await;
        
        // เพิ่มขั้นตอนใหม่
        controller.steps.push(new_step.clone());
        
        // แจ้งการอัปเดต
        let steps_msg = create_message("steps_updated", json!({
            "steps": controller.steps
        }));
        broadcast_to_clients(&controller.clients, steps_msg);
    }
}

// เพิ่มฟังก์ชันเพื่อตรวจสอบว่าคีย์เป็นตัวอักษรหรือไม่
fn is_letter_key(key: &device_query::Keycode) -> bool {
    matches!(key, 
        device_query::Keycode::A | device_query::Keycode::B | 
        device_query::Keycode::C | device_query::Keycode::D | 
        device_query::Keycode::E | device_query::Keycode::F | 
        device_query::Keycode::G | device_query::Keycode::H | 
        device_query::Keycode::I | device_query::Keycode::J | 
        device_query::Keycode::K | device_query::Keycode::L | 
        device_query::Keycode::M | device_query::Keycode::N | 
        device_query::Keycode::O | device_query::Keycode::P | 
        device_query::Keycode::Q | device_query::Keycode::R | 
        device_query::Keycode::S | device_query::Keycode::T | 
        device_query::Keycode::U | device_query::Keycode::V | 
        device_query::Keycode::W | device_query::Keycode::X | 
        device_query::Keycode::Y | device_query::Keycode::Z
    )
} 