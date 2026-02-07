#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

use tauri::Manager;
use std::process::{Command, Stdio};

fn main() {
  // Start Next.js server
  #[cfg(not(debug_assertions))]
  {
    std::thread::spawn(|| {
      let server_path = std::env::current_exe()
        .unwrap()
        .parent()
        .unwrap()
        .join("server")
        .join("server.js");
      
      Command::new("node")
        .arg(server_path)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("Failed to start Next.js server");
    });
    
    // Wait for server to start
    std::thread::sleep(std::time::Duration::from_secs(2));
  }

  tauri::Builder::default()
    .setup(|app| {
      let window = app.get_webview_window("main").unwrap();
      window.set_title("Soundcloudy").unwrap();
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
