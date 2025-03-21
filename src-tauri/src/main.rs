// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::thread;
use tauri::Manager;

fn main() {
    println!("Starting Tauri-macro application...");

    // เริ่มต้น backend server ในอีก thread หนึ่ง
    let backend_thread = thread::spawn(|| {
        println!("Starting backend service...");
        mouse_keyboard_automation::start_server();
    });

    // ตั้งค่า Tauri Application
    tauri::Builder::default()
        .setup(|app| {
            println!("Setting up Tauri application...");
            // เปิด DevTools ในโหมด debug
            #[cfg(debug_assertions)]
            {
                println!("Opening DevTools...");
                app.get_window("main").unwrap().open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    // รอให้ backend thread ทำงานเสร็จ (ซึ่งจริงๆแล้วไม่น่าจะเกิดขึ้น
    // เนื่องจาก Tauri app จะถูกปิดก่อน)
    let _ = backend_thread.join();
}
