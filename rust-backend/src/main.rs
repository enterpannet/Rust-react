mod automation;
mod mouse_keyboard;
mod websocket;
mod models;
mod handlers;

#[allow(unused_imports)]
use warp::Filter;
#[allow(unused_imports)]
use std::sync::Arc;
#[allow(unused_imports)]
use tokio::sync::Mutex;
#[allow(unused_imports)]
use crate::automation::AutomationController;

#[tokio::main]
async fn main() {
    println!("Starting Mouse & Keyboard Automation Server");
    
    // สร้าง shared state สำหรับ automation controller
    let automation = automation::AutomationController::new();
    let automation = std::sync::Arc::new(tokio::sync::Mutex::new(automation));
    
    // สร้าง routes
    let routes = warp::path("ws")
        .and(warp::ws())
        .and(handlers::with_automation(automation.clone()))
        .map(|ws: warp::ws::Ws, automation| {
            ws.on_upgrade(move |socket| websocket::handle_connection(socket, automation))
        });
    
    // สร้าง cors policy
    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "POST", "DELETE", "OPTIONS"])
        .allow_headers(vec!["Content-Type"]);
    
    // เริ่มต้น server
    println!("Server started at http://localhost:5000");
    warp::serve(routes.with(cors))
        .run(([127, 0, 0, 1], 5000))
        .await;
} 