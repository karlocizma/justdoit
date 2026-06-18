// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};

/// The URL the desktop window loads.
///
/// Resolution order:
///   1. `JUSTDOIT_APP_URL` set at runtime (when the app is launched)
///   2. `JUSTDOIT_APP_URL` baked in at compile time (set by the release CI)
///   3. the local Next.js dev server, so `npm run dev` works out of the box
fn app_url() -> String {
    std::env::var("JUSTDOIT_APP_URL")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| option_env!("JUSTDOIT_APP_URL").map(str::to_string))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "http://localhost:3000".to_string())
}

fn main() {
    let url = app_url();

    tauri::Builder::default()
        .setup(move |app| {
            WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(url.parse().expect("JUSTDOIT_APP_URL must be a valid URL")),
            )
            .title("JustDoIt")
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the JustDoIt desktop app");
}
