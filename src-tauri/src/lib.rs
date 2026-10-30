use std::{io::Write, path::Path};
use tauri_plugin_dialog::DialogExt;

const MAX_BACKUP_BYTES: usize = 20 * 1024 * 1024;

fn validate_backup(contents: &str, file_name: &str) -> Result<(), String> {
    if contents.len() > MAX_BACKUP_BYTES {
        return Err("La sauvegarde dépasse la limite de 20 Mo.".into());
    }
    if file_name.len() > 200
        || file_name.contains(['/', '\\'])
        || !file_name.ends_with(".json")
        || Path::new(file_name).file_name().and_then(|s| s.to_str()) != Some(file_name)
    {
        return Err("Nom de sauvegarde invalide.".into());
    }
    let value: serde_json::Value = serde_json::from_str(contents)
        .map_err(|_| "La sauvegarde ne contient pas un JSON valide.")?;
    if value["app"] != "REAL_LIFE_RPG" || value["formatVersion"] != 1 {
        return Err("Seules les sauvegardes REAL LIFE RPG sont autorisées.".into());
    }
    Ok(())
}

fn write_backup(path: &Path, contents: &str) -> Result<(), String> {
    let parent = path.parent().ok_or("Dossier de destination invalide.")?;
    let mut file = tempfile::NamedTempFile::new_in(parent)
        .map_err(|e| format!("Impossible de préparer la sauvegarde : {e}"))?;
    file.write_all(contents.as_bytes())
        .and_then(|_| file.as_file().sync_all())
        .map_err(|e| format!("Impossible d’écrire la sauvegarde : {e}"))?;
    file.persist(path)
        .map_err(|e| format!("Impossible d’enregistrer la sauvegarde : {}", e.error))?;
    Ok(())
}

// No frontend-supplied filesystem path: the user must choose a file in a native dialog.
#[tauri::command]
async fn export_backup(
    app: tauri::AppHandle,
    contents: String,
    file_name: String,
) -> Result<bool, String> {
    validate_backup(&contents, &file_name)?;
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .set_title("Enregistrer ma sauvegarde REAL LIFE RPG")
            .set_file_name(&file_name)
            .add_filter("Sauvegarde JSON", &["json"])
            .blocking_save_file();
        let Some(selected) = selected else {
            return Ok(false);
        };
        let path = selected
            .into_path()
            .map_err(|_| "Destination locale invalide.")?;
        write_backup(&path, &contents)?;
        Ok(true)
    })
    .await
    .map_err(|e| format!("La sauvegarde n’a pas pu aboutir : {e}"))?
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![export_backup])
        .setup(|app| {
            tauri::WebviewWindowBuilder::from_config(app, &app.config().app.windows[0])?
                .on_navigation(|url| {
                    if cfg!(debug_assertions) {
                        url.scheme() == "http"
                            && url.host_str() == Some("127.0.0.1")
                            && url.port() == Some(1420)
                    } else {
                        (url.scheme() == "https" && url.host_str() == Some("tauri.localhost"))
                            || (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
                    }
                })
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Impossible de lancer REAL LIFE RPG");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_guard_and_atomic_replacement() {
        let json = r#"{"app":"REAL_LIFE_RPG","formatVersion":1,"data":{}}"#;
        assert!(validate_backup(json, "sauvegarde.json").is_ok());
        assert!(validate_backup(json, "../sauvegarde.json").is_err());
        assert!(validate_backup("{}", "sauvegarde.json").is_err());
        assert!(validate_backup(&" ".repeat(MAX_BACKUP_BYTES + 1), "sauvegarde.json").is_err());
        let folder = tempfile::tempdir().unwrap();
        let target = folder.path().join("sauvegarde.json");
        std::fs::write(&target, "ancienne sauvegarde").unwrap();
        write_backup(&target, json).unwrap();
        assert_eq!(std::fs::read_to_string(&target).unwrap(), json);
        assert_eq!(std::fs::read_dir(folder.path()).unwrap().count(), 1);
    }
}
