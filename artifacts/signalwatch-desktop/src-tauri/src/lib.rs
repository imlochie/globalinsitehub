//! Signalwatch desktop shell.
//!
//! The canonical Signalwatch client is the web app in `artifacts/signalwatch`;
//! this shell serves exactly those assets, so desktop and browser cannot drift.
//!
//! The shell is self-contained: it starts the real Signalwatch API as a child
//! process from bundled resources, on a port chosen at runtime, and tells the
//! frontend where to find it. The executable therefore does not depend on any
//! hosted service.
//!
//! Self-contained is NOT the same as offline: the API still reaches out to the
//! public providers (cameras, civic incidents, hazards, AIS) over the user's
//! internet connection. Without connectivity the layers degrade honestly and
//! report their providers as unavailable, exactly as they do on the web.

use std::net::TcpListener;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

/// Holds the API child process so it can be terminated with the window.
struct ApiSidecar(Mutex<Option<Child>>);

/// Asks the OS for an unused loopback port.
///
/// A fixed port would collide with another Signalwatch instance, or with
/// whatever else the user happens to be running.
fn free_port() -> std::io::Result<u16> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

/// Blocks until the API answers its health endpoint, or the deadline passes.
fn wait_for_api(port: u16, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if std::net::TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(120));
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(ApiSidecar(Mutex::new(None)))
        .setup(|app| {
            let resource_dir = app.path().resource_dir()?;
            let runtime_name = if cfg!(windows) { "node.exe" } else { "node" };
            let runtime = resource_dir.join("resources/runtime").join(runtime_name);
            let entry = resource_dir.join("resources/api/index.mjs");

            let port = free_port()?;

            let child = Command::new(&runtime)
                .arg(&entry)
                .env("PORT", port.to_string())
                .env("NODE_ENV", "production")
                // Bind loopback only: the bundled API must never be reachable
                // from outside the machine running the app.
                .env("HOST", "127.0.0.1")
                .spawn()
                .map_err(|error| {
                    format!(
                        "failed to start the bundled Signalwatch API at {}: {error}",
                        runtime.display()
                    )
                })?;

            app.state::<ApiSidecar>()
                .0
                .lock()
                .expect("sidecar lock")
                .replace(child);

            if !wait_for_api(port, Duration::from_secs(20)) {
                return Err("the bundled Signalwatch API did not start in time".into());
            }

            let api_base = format!("http://127.0.0.1:{port}");
            // The frontend reads this before mounting and routes every request
            // to the bundled API. Build-time configuration cannot express a
            // port chosen at runtime, so it is injected here.
            let init = format!(
                "window.__SIGNALWATCH_API_BASE__ = {};",
                serde_json::to_string(&api_base).unwrap_or_else(|_| "null".into())
            );

            WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Signalwatch")
                .inner_size(1440.0, 900.0)
                .min_inner_size(960.0, 640.0)
                .resizable(true)
                .initialization_script(&init)
                .build()?;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Signalwatch desktop");

    app.run(|handle, event| {
        // Never leave the API running after the window is gone.
        if let RunEvent::Exit = event {
            if let Some(mut child) = handle
                .state::<ApiSidecar>()
                .0
                .lock()
                .expect("sidecar lock")
                .take()
            {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    });
}
