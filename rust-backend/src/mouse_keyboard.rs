use enigo::{Enigo, KeyboardControllable, MouseControllable, MouseButton as EnigoMouseButton};
use device_query::{DeviceQuery, DeviceState, Keycode};
use tokio::sync::mpsc::Sender;
use std::thread;
use tokio::task;
use clipboard_win::{formats, get_clipboard, set_clipboard};
use std::time::Duration;

// นิยามประเภทของเหตุการณ์เมาส์
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub enum MouseEvent {
    Click {
        button: MouseButton,
        x: i32,
        y: i32,
    },
}

// นิยามประเภทของปุ่มเมาส์
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}

// นิยามประเภทของเหตุการณ์คีย์บอร์ด
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub enum KeyboardEvent {
    KeyPress {
        key: String,
    },
}

// ฟังก์ชันสำหรับดึงตำแหน่งเมาส์ปัจจุบัน (non-async version)
#[allow(dead_code)]
pub fn get_cursor_position() -> (i32, i32) {
    let device_state = DeviceState::new();
    let mouse_state = device_state.get_mouse();
    (mouse_state.coords.0 as i32, mouse_state.coords.1 as i32)
}

// ฟังก์ชันสำหรับดึงตำแหน่งเมาส์ปัจจุบัน (async version)
#[allow(dead_code)]
pub async fn get_mouse_position() -> (i32, i32) {
    task::spawn_blocking(move || {
        let device_state = DeviceState::new();
        let mouse_state = device_state.get_mouse();
        (mouse_state.coords.0 as i32, mouse_state.coords.1 as i32)
    }).await.unwrap_or((0, 0))
}

// เลื่อนเมาส์ไปยังตำแหน่งที่กำหนด
#[allow(dead_code)]
pub async fn mouse_move(x: i32, y: i32) {
    task::spawn_blocking(move || {
        let mut enigo = Enigo::new();
        enigo.mouse_move_to(x, y);
    }).await.unwrap_or(());
}

// คลิกเมาส์
#[allow(dead_code)]
pub async fn mouse_click(button: MouseButton) {
    task::spawn_blocking(move || {
        let mut enigo = Enigo::new();
        match button {
            MouseButton::Left => enigo.mouse_click(EnigoMouseButton::Left),
            MouseButton::Right => enigo.mouse_click(EnigoMouseButton::Right),
            MouseButton::Middle => enigo.mouse_click(EnigoMouseButton::Middle),
        }
    }).await.unwrap_or(());
}

// ดับเบิลคลิกเมาส์
#[allow(dead_code)]
pub async fn mouse_double_click(button: MouseButton) {
    task::spawn_blocking(move || {
        let mut enigo = Enigo::new();
        match button {
            MouseButton::Left => {
                enigo.mouse_click(EnigoMouseButton::Left);
                // หน่วงเวลาเล็กน้อยระหว่างคลิก
                thread::sleep(std::time::Duration::from_millis(50));
                enigo.mouse_click(EnigoMouseButton::Left);
            },
            MouseButton::Right => {
                enigo.mouse_click(EnigoMouseButton::Right);
                thread::sleep(std::time::Duration::from_millis(50));
                enigo.mouse_click(EnigoMouseButton::Right);
            },
            MouseButton::Middle => {
                enigo.mouse_click(EnigoMouseButton::Middle);
                thread::sleep(std::time::Duration::from_millis(50));
                enigo.mouse_click(EnigoMouseButton::Middle);
            },
        }
    }).await.unwrap_or(());
}

// ฟังก์ชันสำหรับ Copy (Ctrl+C)
#[allow(dead_code)]
pub async fn perform_copy() {
    task::spawn_blocking(move || {
        println!("Executing Copy (Ctrl+C) command");
        
        let mut enigo = Enigo::new();
        enigo.key_down(enigo::Key::Control);
        thread::sleep(std::time::Duration::from_millis(100));
        enigo.key_click(enigo::Key::Layout('c'));
        thread::sleep(std::time::Duration::from_millis(100));
        enigo.key_up(enigo::Key::Control);
        
        // รอให้การคัดลอกเสร็จสมบูรณ์
        thread::sleep(std::time::Duration::from_millis(300));
    }).await.unwrap_or(());
}

// ฟังก์ชันสำหรับ Paste (Ctrl+V)
#[allow(dead_code)]
pub async fn perform_paste() {
    task::spawn_blocking(move || {
        println!("Executing Paste (Ctrl+V) command");
        
        let mut enigo = Enigo::new();
        enigo.key_down(enigo::Key::Control);
        thread::sleep(std::time::Duration::from_millis(100));
        enigo.key_click(enigo::Key::Layout('v'));
        thread::sleep(std::time::Duration::from_millis(100));
        enigo.key_up(enigo::Key::Control);
        
        // รอให้การวางเสร็จสมบูรณ์
        thread::sleep(std::time::Duration::from_millis(300));
    }).await.unwrap_or(());
}

// ฟังก์ชันสำหรับ Select All (Ctrl+A)
#[allow(dead_code)]
pub async fn perform_select_all() {
    task::spawn_blocking(move || {
        println!("Executing Select All (Ctrl+A) command");
        
        let mut enigo = Enigo::new();
        enigo.key_down(enigo::Key::Control);
        thread::sleep(std::time::Duration::from_millis(100)); // เพิ่มเวลารอเป็น 100ms
        enigo.key_click(enigo::Key::Layout('a'));
        thread::sleep(std::time::Duration::from_millis(100)); // เพิ่มเวลารอเป็น 100ms
        enigo.key_up(enigo::Key::Control);
        
        // รอให้การเลือกเสร็จสมบูรณ์
        thread::sleep(std::time::Duration::from_millis(300)); // เพิ่มเวลารอเป็น 300ms
    }).await.unwrap_or(());
}

// ฟังก์ชันสำหรับการกดคีย์แบบทั่วไป
pub async fn keyboard_press_key(key: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    println!("Pressing key: {}", key);
    
    let key = key.to_string();
    task::spawn_blocking(move || -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut enigo = Enigo::new();
        let mut has_modifiers = false;
        
        // หลังจากการแก้ไข จะตรวจสอบทั้ง ctrl และ Control
        if key.to_lowercase().contains("ctrl+") || key.to_lowercase().contains("control+") {
            has_modifiers = true;
            
            // ตรวจสอบคีย์ย่อย
            let sub_key = if key.to_lowercase().contains("ctrl+") {
                key.split("ctrl+").collect::<Vec<&str>>()[1].to_lowercase()
            } else {
                key.split("control+").collect::<Vec<&str>>()[1].to_lowercase()
            };
            
            println!("Pressing Control + {}", sub_key);
            
            // พิเศษสำหรับ Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
            match sub_key.as_str() {
                "a" => {
                    // Select All
                    println!("Special command: Select All");
                    enigo.key_down(enigo::Key::Control);
                    thread::sleep(Duration::from_millis(100));
                    enigo.key_click(enigo::Key::Layout('a'));
                    thread::sleep(Duration::from_millis(100));
                    enigo.key_up(enigo::Key::Control);
                    thread::sleep(Duration::from_millis(300));
                    return Ok(());
                },
                "c" => {
                    // Copy
                    println!("Special command: Copy");
                    enigo.key_down(enigo::Key::Control);
                    thread::sleep(Duration::from_millis(100));
                    enigo.key_click(enigo::Key::Layout('c'));
                    thread::sleep(Duration::from_millis(100));
                    enigo.key_up(enigo::Key::Control);
                    thread::sleep(Duration::from_millis(300));
                    return Ok(());
                },
                "v" => {
                    // Paste
                    println!("Special command: Paste");
                    enigo.key_down(enigo::Key::Control);
                    thread::sleep(Duration::from_millis(100));
                    enigo.key_click(enigo::Key::Layout('v'));
                    thread::sleep(Duration::from_millis(100));
                    enigo.key_up(enigo::Key::Control);
                    thread::sleep(Duration::from_millis(300));
                    return Ok(());
                },
                "x" => {
                    // Cut
                    println!("Special command: Cut");
                    // ทำ Select All ก่อน
                    enigo.key_down(enigo::Key::Control);
                    thread::sleep(Duration::from_millis(100));
                    enigo.key_click(enigo::Key::Layout('a'));
                    thread::sleep(Duration::from_millis(300));
                    // ทำ Cut
                    enigo.key_click(enigo::Key::Layout('x'));
                    thread::sleep(Duration::from_millis(100));
                    enigo.key_up(enigo::Key::Control);
                    thread::sleep(Duration::from_millis(300));
                    return Ok(());
                },
                _ => {
                    // กรณีอื่นๆ ใช้ enigo
                    enigo.key_down(enigo::Key::Control);
                    thread::sleep(Duration::from_millis(100));
                    
                    if sub_key.len() == 1 {
                        let c = sub_key.chars().next().unwrap();
                        enigo.key_click(enigo::Key::Layout(c));
                    } else {
                        // พยายามแปลงเป็นคีย์พิเศษ
                        match sub_key.as_str() {
                            "tab" => enigo.key_click(enigo::Key::Tab),
                            "enter" => enigo.key_click(enigo::Key::Return),
                            "backspace" => enigo.key_click(enigo::Key::Backspace),
                            "delete" => enigo.key_click(enigo::Key::Delete),
                            "home" => enigo.key_click(enigo::Key::Home),
                            "end" => enigo.key_click(enigo::Key::End),
                            "pageup" => enigo.key_click(enigo::Key::PageUp),
                            "pagedown" => enigo.key_click(enigo::Key::PageDown),
                            "up" => enigo.key_click(enigo::Key::UpArrow),
                            "down" => enigo.key_click(enigo::Key::DownArrow),
                            "left" => enigo.key_click(enigo::Key::LeftArrow),
                            "right" => enigo.key_click(enigo::Key::RightArrow),
                            "space" => enigo.key_click(enigo::Key::Space),
                            "escape" => enigo.key_click(enigo::Key::Escape),
                            "f1" => enigo.key_click(enigo::Key::F1),
                            "f2" => enigo.key_click(enigo::Key::F2),
                            "f3" => enigo.key_click(enigo::Key::F3),
                            "f4" => enigo.key_click(enigo::Key::F4),
                            "f5" => enigo.key_click(enigo::Key::F5),
                            "f6" => enigo.key_click(enigo::Key::F6),
                            "f7" => enigo.key_click(enigo::Key::F7),
                            "f8" => enigo.key_click(enigo::Key::F8),
                            "f9" => enigo.key_click(enigo::Key::F9),
                            "f10" => enigo.key_click(enigo::Key::F10),
                            "f11" => enigo.key_click(enigo::Key::F11),
                            "f12" => enigo.key_click(enigo::Key::F12),
                            _ => {
                                println!("Unsupported key: {}", sub_key);
                                return Err(Box::new(std::io::Error::new(
                                    std::io::ErrorKind::InvalidInput,
                                    format!("Unsupported key: {}", sub_key),
                                )));
                            }
                        }
                    }
                    
                    thread::sleep(Duration::from_millis(100));
                    enigo.key_up(enigo::Key::Control);
                }
            }
        }
        
        // ปรับปรุงการจัดการกับคีย์อื่นๆ (ไม่มี modifier)
        if !has_modifiers {
            // สำหรับอักขระเดี่ยว
            if key.len() == 1 {
                let c = key.chars().next().unwrap();
                // แทนที่การใช้ key_click ด้วยการใช้ key_down และ key_up
                println!("Typing single character: {}", c);
                enigo.key_down(enigo::Key::Layout(c));
                thread::sleep(Duration::from_millis(50));
                enigo.key_up(enigo::Key::Layout(c));
                thread::sleep(Duration::from_millis(50));
            } else {
                // สำหรับคีย์พิเศษ
                match key.to_lowercase().as_str() {
                    "tab" => enigo.key_click(enigo::Key::Tab),
                    "enter" => enigo.key_click(enigo::Key::Return),
                    "backspace" => enigo.key_click(enigo::Key::Backspace),
                    "delete" => enigo.key_click(enigo::Key::Delete),
                    "home" => enigo.key_click(enigo::Key::Home),
                    "end" => enigo.key_click(enigo::Key::End),
                    "pageup" => enigo.key_click(enigo::Key::PageUp),
                    "pagedown" => enigo.key_click(enigo::Key::PageDown),
                    "up" => enigo.key_click(enigo::Key::UpArrow),
                    "down" => enigo.key_click(enigo::Key::DownArrow),
                    "left" => enigo.key_click(enigo::Key::LeftArrow),
                    "right" => enigo.key_click(enigo::Key::RightArrow),
                    "space" => enigo.key_click(enigo::Key::Space),
                    "escape" => enigo.key_click(enigo::Key::Escape),
                    "f1" => enigo.key_click(enigo::Key::F1),
                    "f2" => enigo.key_click(enigo::Key::F2),
                    "f3" => enigo.key_click(enigo::Key::F3),
                    "f4" => enigo.key_click(enigo::Key::F4),
                    "f5" => enigo.key_click(enigo::Key::F5),
                    "f6" => enigo.key_click(enigo::Key::F6),
                    "f7" => enigo.key_click(enigo::Key::F7),
                    "f8" => enigo.key_click(enigo::Key::F8),
                    "f9" => enigo.key_click(enigo::Key::F9),
                    "f10" => enigo.key_click(enigo::Key::F10),
                    "f11" => enigo.key_click(enigo::Key::F11),
                    "f12" => enigo.key_click(enigo::Key::F12),
                    _ => {
                        println!("Unsupported key: {}", key);
                        return Err(Box::new(std::io::Error::new(
                            std::io::ErrorKind::InvalidInput,
                            format!("Unsupported key: {}", key),
                        )));
                    }
                }
            }
        }
        
        Ok(())
    }).await?
}

// ฟังก์ชันใหม่สำหรับทำงานกับคลิปบอร์ดโดยตรง
#[allow(dead_code)]
pub async fn get_clipboard_text() -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    task::spawn_blocking(move || {
        get_clipboard(formats::Unicode).map_err(|e| -> Box<dyn std::error::Error + Send + Sync> {
            Box::new(std::io::Error::new(std::io::ErrorKind::Other, format!("Clipboard error: {}", e)))
        })
    }).await?
}

#[allow(dead_code)]
pub async fn set_clipboard_text(text: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let text = text.to_string();
    task::spawn_blocking(move || {
        set_clipboard(formats::Unicode, text).map_err(|e| -> Box<dyn std::error::Error + Send + Sync> {
            Box::new(std::io::Error::new(std::io::ErrorKind::Other, format!("Clipboard error: {}", e)))
        })
    }).await?
}

// เริ่มติดตามเหตุการณ์เมาส์
#[allow(dead_code)]
pub async fn start_mouse_listener(tx: Sender<MouseEvent>) {
    // สร้าง thread ใหม่สำหรับติดตามเมาส์
    thread::spawn(move || {
        let device_state = DeviceState::new();
        let mut last_button_state = [false; 3]; // [left, right, middle]
        
        loop {
            let mouse_state = device_state.get_mouse();
            let current_button_state = [
                mouse_state.button_pressed[1], // left
                mouse_state.button_pressed[2], // right
                mouse_state.button_pressed[3], // middle
            ];
            
            // ตรวจสอบการกดปุ่มเมาส์
            for (i, &pressed) in current_button_state.iter().enumerate() {
                if pressed && !last_button_state[i] {
                    // ปุ่มถูกกด
                    let button = match i {
                        0 => MouseButton::Left,
                        1 => MouseButton::Right,
                        2 => MouseButton::Middle,
                        _ => continue,
                    };
                    
                    let event = MouseEvent::Click {
                        button,
                        x: mouse_state.coords.0 as i32,
                        y: mouse_state.coords.1 as i32,
                    };
                    
                    // ส่งเหตุการณ์ไปยัง channel
                    let cloned_tx = tx.clone();
                    tokio::runtime::Handle::current().block_on(async {
                        let _ = cloned_tx.send(event).await;
                    });
                }
            }
            
            last_button_state = current_button_state;
            
            // หน่วงเวลาเพื่อลด CPU usage
            thread::sleep(std::time::Duration::from_millis(10));
        }
    });
}

// เริ่มติดตามเหตุการณ์คีย์บอร์ด
#[allow(dead_code)]
pub async fn start_keyboard_listener(tx: Sender<KeyboardEvent>) {
    // สร้าง thread ใหม่สำหรับติดตามคีย์บอร์ด
    thread::spawn(move || {
        let device_state = DeviceState::new();
        let mut last_keys: Vec<Keycode> = Vec::new();
        
        loop {
            let keys = device_state.get_keys();
            
            // ตรวจสอบว่ามีปุ่มใหม่ถูกกดหรือไม่
            for key in &keys {
                if !last_keys.contains(key) {
                    // ปุ่มถูกกด
                    let key_str = format!("{:?}", key);
                    
                    let event = KeyboardEvent::KeyPress {
                        key: key_str,
                    };
                    
                    // ส่งเหตุการณ์ไปยัง channel
                    let cloned_tx = tx.clone();
                    tokio::runtime::Handle::current().block_on(async {
                        let _ = cloned_tx.send(event).await;
                    });
                }
            }
            
            last_keys = keys;
            
            // หน่วงเวลาเพื่อลด CPU usage
            thread::sleep(std::time::Duration::from_millis(10));
        }
    });
} 