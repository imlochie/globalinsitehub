//! Signalwatch desktop shell.
//!
//! This is deliberately a thin shell: the canonical Signalwatch client is the
//! web app in `artifacts/signalwatch`, and the desktop build serves exactly
//! those assets. No desktop-only product logic lives here, so the desktop and
//! browser clients cannot drift apart.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Signalwatch desktop");
}
