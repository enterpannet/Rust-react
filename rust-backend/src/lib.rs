mod automation;
mod mouse_keyboard;
mod websocket;
mod models;
mod handlers;

// Re-export สิ่งที่จำเป็นสำหรับผู้ใช้งาน library
pub use automation::AutomationController;
pub use models::{MacroStep, ClickType, StatusUpdate, StepsUpdate, MousePosition, StepExecuting, RandomTimingConfig};

use tokio::runtime::Runtime;
use warp::Filter;

/// ฟังก์ชันสำหรับสร้าง server instance ใช้งานได้ทั้ง library และ binary
pub fn create_server_instance() -> std::sync::Arc<tokio::sync::Mutex<AutomationController>> {
    // สร้าง shared state สำหรับ automation controller
    let automation = automation::AutomationController::new();
    let automation = std::sync::Arc::new(tokio::sync::Mutex::new(automation));
    
    automation
}

/// ฟังก์ชันสำหรับสร้าง AutomationController
pub fn create_automation_controller() -> std::sync::Arc<tokio::sync::Mutex<AutomationController>> {
    std::sync::Arc::new(tokio::sync::Mutex::new(AutomationController::new()))
}

/// เริ่มต้น web server สำหรับ mouse & keyboard automation
pub fn start_server() {
    // สร้าง Tokio runtime สำหรับใช้งาน async
    let rt = Runtime::new().unwrap();
    
    // สั่งให้ runtime รัน async main function ของเรา
    rt.block_on(async {
        // เรียกใช้ฟังก์ชัน main ของโปรเจค
        if let Err(e) = crate::run_server().await {
            eprintln!("Server error: {}", e);
        }
    });
}

// สำหรับการรันเป็น binary ปกติ
pub async fn run_server() -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting Mouse & Keyboard Automation Server");
    
    // สร้าง shared state สำหรับ automation controller
    let automation = automation::AutomationController::new();
    let automation = std::sync::Arc::new(tokio::sync::Mutex::new(automation));
    
    // สร้าง routes
    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(handlers::with_automation(automation.clone()))
        .map(|ws: warp::ws::Ws, automation| {
            ws.on_upgrade(move |socket| websocket::handle_connection(socket, automation))
        });
    
    // สร้าง route สำหรับ socket.io compatibility
    let socket_io_route = warp::path("socket.io")
        .and(warp::ws())
        .and(handlers::with_automation(automation.clone()))
        .map(|ws: warp::ws::Ws, automation| {
            ws.on_upgrade(move |socket| websocket::handle_connection(socket, automation))
        });
    
    // รวม routes
    let routes = ws_route.or(socket_io_route);
    
    // สร้าง cors policy
    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "POST", "DELETE", "OPTIONS", "PUT"])
        .allow_headers(vec!["Content-Type", "Authorization", "X-Requested-With"])
        .expose_headers(vec!["Content-Disposition"]);
    
    // เริ่มต้น server
    println!("Server started at http://localhost:5000");
    
    // เริ่มติดตามตำแหน่งเมาส์แบบเรียลไทม์
    websocket::start_mouse_position_tracking(automation.clone());
    
    warp::serve(routes.with(cors))
        .run(([127, 0, 0, 1], 5000))
        .await;
    
    Ok(())
}