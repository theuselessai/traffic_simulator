use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            let click_through =
                MenuItem::with_id(app, "click_through", "Toggle Click-Through", true, None::<&str>)?;
            let reset_pos =
                MenuItem::with_id(app, "reset_pos", "Reset Position", true, None::<&str>)?;
            let autostart =
                MenuItem::with_id(app, "autostart", "Start at Login", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show, &hide, &click_through, &reset_pos, &autostart, &quit])?;

            TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "click_through" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("toggle-click-through", ());
                        }
                    }
                    "reset_pos" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("reset-position", ());
                        }
                    }
                    "autostart" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("toggle-autostart", ());
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
