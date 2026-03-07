// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Emitter};
use tiny_http::{Response, Server};
use open;

// NEW: Rust command to open the system browser
#[tauri::command]
fn open_in_browser(url: String) {
    open::that(url).expect("Failed to open browser");
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // Spawn the redirect listener thread
            std::thread::spawn(move || {
                let server = Server::http("127.0.0.1:1420").unwrap();

                for request in server.incoming_requests() {
                    let url = format!("http://127.0.0.1:1420{}", request.url());

                    handle.emit("spotify-oauth-callback", url).unwrap();

                    let response = Response::from_string("You may close this window.");
                    let _ = request.respond(response);
                }
            });

            Ok(())
        })
        // NEW: register the browser-opening command
        .invoke_handler(tauri::generate_handler![
            open_in_browser
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}