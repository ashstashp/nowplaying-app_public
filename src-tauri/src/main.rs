#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Emitter, Manager};
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

// // Prevents additional console window on Windows in release, DO NOT REMOVE!!
// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// fn main() {
//     nowplaying_app_public_lib::run();

//     // tauri::Builder::default()
//     //     .register_uri_scheme_protocol("nowplaying", |app, request| {
//     //         let url = request.uri().to_string();

//     //         // Get the real AppHandle
//     //         let handle = app.app_handle();

//     //         // Emit event to frontend
//     //         handle.emit("spotify-oauth", url).unwrap();

//     //         // Respond to the browser (body must be Vec<u8>)
//     //         tauri::http::Response::builder()
//     //             .status(200)
//     //             .header("Content-Type", "text/plain")
//     //             .body("You may close this window now.".as_bytes().to_vec())
//     //             .unwrap()
//     //     })
//     //     .run(tauri::generate_context!())
//     //     .expect("error while running tauri application");
// }
