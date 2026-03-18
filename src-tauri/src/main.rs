// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use open;
use tauri::Emitter;
use tiny_http::{Response, Server};

// NEW: Rust command to open the system browser
#[tauri::command]
fn open_in_browser(url: String) {
    open::that(url).expect("Failed to open browser");
}

use tauri_plugin_keyring::KeyringExt;

#[tauri::command]
fn init_keyring(app: tauri::AppHandle) -> Result<(), String> {
    app.keyring()
        .initialize_service("com.ashstashp.nowplaying-app".into())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn store_user_token(
    app: tauri::AppHandle,
    user_id: String,
    token: String,
) -> Result<(), String> {
    // Initialize keyring for your service
    // app.keyring()
    //     .initialize_service(app)
    //     .map_err(|e| e.to_string())?;

    // Store the token securely
    app.keyring()
        .set(
            &user_id,
            tauri_plugin_keyring::CredentialType::Password,
            tauri_plugin_keyring::CredentialValue::Password(token),
        )
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn get_user_token(app: tauri::AppHandle, user_id: String) -> Result<String, String> {
    match app
        .keyring()
        .get(&user_id, tauri_plugin_keyring::CredentialType::Password)
    {
        Ok(tauri_plugin_keyring::CredentialValue::Password(token)) => Ok(token),
        Err(e) => Err(e.to_string()),
        _ => Err("Invalid credential type".to_string()),
    }
}

#[derive(Default)]
struct MyState {
    s: std::sync::Mutex<String>,
    t: std::sync::Mutex<std::collections::HashMap<String, String>>,
}
// remember to call `.manage(MyState::default())`
#[tauri::command]
async fn delete_user_token(app: tauri::AppHandle, user_id: String) -> Result<(), String> {
    app.keyring()
        .delete(&user_id, tauri_plugin_keyring::CredentialType::Password)
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_keyring::init())
        .setup(|app| {
            let handle = app.handle().clone();
            init_keyring(app.handle().clone())?;

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
            open_in_browser,
            get_user_token,
            store_user_token,
            delete_user_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
