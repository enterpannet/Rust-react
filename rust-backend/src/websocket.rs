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
                    
                    // เรียกใช้ฟังก์ชันทำงานตามขั้นตอน
                    let steps_clone = controller.steps.clone();
                    let controller_clone = automation_controller.clone();
                    execute_automation(controller_clone, steps_clone, loop_count, None).await;
                }
            },
            "run_selected_steps" => {
                // เริ่มการทำงานอัตโนมัติเฉพาะสเต็ปที่เลือก
                if let Some(data) = json_data.get("data") {
                    if let Some(step_ids) = data.get("step_ids").and_then(|v| v.as_array()) {
                        // แปลง array ของ step IDs เป็น Vector ของ string
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
                    
                    // เพิ่มตัวบันทึกเหตุการณ์เมาส์และแป้นพิมพ์
                    let controller_clone = automation_controller.clone();
                    start_event_recorder(controller_clone);
                    
                    // แจ้งการอัปเดต
                    let status_msg = create_message("status_update", json!({
                        "status": "recording",
                        "message": "Recording started - Capturing mouse movements, clicks, and keyboard presses"
                    }));
                    broadcast_to_clients(&controller.clients, status_msg);
                    println!("Recording started");
                }
            },
            "stop_recording" => {
                // หยุดการบันทึก
                if controller.is_recording {
                    controller.is_recording = false;
                    
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
                    
                    // เพิ่มตัวบันทึกเหตุการณ์เมาส์และแป้นพิมพ์
                    let controller_clone = automation_controller.clone();
                    start_event_recorder(controller_clone);
                    
                    // แจ้งการอัปเดต
                    let status_msg = create_message("status_update", json!({
                        "status": "recording",
                        "message": "Recording started - Capturing mouse movements, clicks, and keyboard presses"
                    }));
                    broadcast_to_clients(&controller.clients, status_msg);
                    println!("Recording started (from toggle)");
                } else {
                    // หยุดการบันทึก
                    controller.is_recording = false;
                    
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
        let mut last_position = (0, 0);
        let mut last_mouse_buttons = vec![false; 10]; // เก็บสถานะปุ่มเมาส์ล่าสุด
        let mut last_keys = device_state.get_keys();
        
        // ตั้งค่าขั้นต่ำของการเคลื่อนไหวเมาส์ที่จะบันทึก (หน่วยพิกเซล)
        const MIN_MOUSE_MOVEMENT: i32 = 5;
        
        // จับเหตุการณ์ทุก 50 มิลลิวินาที (20 FPS)
        let poll_interval = std::time::Duration::from_millis(50);
        
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
            let dx = (current_position.0 - last_position.0).abs();
            let dy = (current_position.1 - last_position.1).abs();
            
            // บันทึกการเคลื่อนไหวเมาส์ถ้ามีการเปลี่ยนแปลงมากกว่าขั้นต่ำ
            if dx > MIN_MOUSE_MOVEMENT || dy > MIN_MOUSE_MOVEMENT {
                // เพิ่มขั้นตอนการเคลื่อนไหวเมาส์
                let step_data = json!({
                    "type": "mouse_move",
                    "x": current_position.0,
                    "y": current_position.1,
                    "wait_time": 0.1,  // เวลารอสั้นๆ
                    "randomize": false
                });
                
                // ส่งคำสั่งเพิ่มขั้นตอน
                add_recorded_step(&controller, "mouse_move", &step_data).await;
                
                last_position = current_position;
            }
            
            // ตรวจสอบการคลิกเมาส์โดยใช้ device_query
            let mouse_state = device_state.get_mouse();
            
            // ตรวจสอบปุ่มซ้าย (index อาจแตกต่างขึ้นอยู่กับไลบรารี)
            if *mouse_state.button_pressed.get(0).unwrap_or(&false) && !last_mouse_buttons[0] {
                let step_data = json!({
                    "type": "mouse_click",
                    "button": "left",
                    "wait_time": 0.5,
                    "randomize": false
                });
                
                add_recorded_step(&controller, "mouse_click", &step_data).await;
                println!("Recorded: Left click at {:?}", current_position);
            }
            
            // ตรวจสอบปุ่มขวา
            if *mouse_state.button_pressed.get(1).unwrap_or(&false) && !last_mouse_buttons[1] {
                let step_data = json!({
                    "type": "mouse_click",
                    "button": "right",
                    "wait_time": 0.5,
                    "randomize": false
                });
                
                add_recorded_step(&controller, "mouse_click", &step_data).await;
                println!("Recorded: Right click at {:?}", current_position);
            }
            
            // ตรวจสอบปุ่มกลาง
            if *mouse_state.button_pressed.get(2).unwrap_or(&false) && !last_mouse_buttons[2] {
                let step_data = json!({
                    "type": "mouse_click",
                    "button": "middle",
                    "wait_time": 0.5,
                    "randomize": false
                });
                
                add_recorded_step(&controller, "mouse_click", &step_data).await;
                println!("Recorded: Middle click at {:?}", current_position);
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
            
            for key in &current_keys {
                if !last_keys.contains(key) {
                    // เจอปุ่มใหม่ที่ถูกกด
                    let key_str = format!("{:?}", key);
                    
                    let step_data = json!({
                        "type": "key_press",
                        "key": key_str,
                        "wait_time": 0.3,
                        "randomize": false
                    });
                    
                    add_recorded_step(&controller, "key_press", &step_data).await;
                    println!("Recorded: Key press {}", key_str);
                }
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