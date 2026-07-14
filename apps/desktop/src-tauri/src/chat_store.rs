use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

fn chat_root(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let chat_dir = dir.join("chat");
    fs::create_dir_all(&chat_dir).map_err(|error| error.to_string())?;
    Ok(chat_dir)
}

fn sanitize_conversation_id(conversation_id: &str) -> Result<String, String> {
    if conversation_id.is_empty() || conversation_id.len() > 128 {
        return Err("invalid conversation id".into());
    }

    if conversation_id
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
    {
        Ok(conversation_id.to_string())
    } else {
        Err("invalid conversation id".into())
    }
}

#[tauri::command]
pub fn chat_load_conversations(app: AppHandle) -> Result<Option<String>, String> {
    let path = chat_root(&app)?.join("conversations.json");
    if !path.exists() {
        return Ok(None);
    }

    fs::read_to_string(path).map(Some).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn chat_save_conversations(app: AppHandle, payload: String) -> Result<(), String> {
    let path = chat_root(&app)?.join("conversations.json");
    fs::write(path, payload).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn chat_load_messages(
    app: AppHandle,
    conversation_id: String,
) -> Result<Option<String>, String> {
    let conversation_id = sanitize_conversation_id(&conversation_id)?;
    let path = chat_root(&app)?
        .join("history")
        .join(format!("{conversation_id}.json"));

    if !path.exists() {
        return Ok(None);
    }

    fs::read_to_string(path).map(Some).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn chat_save_messages(
    app: AppHandle,
    conversation_id: String,
    payload: String,
) -> Result<(), String> {
    let conversation_id = sanitize_conversation_id(&conversation_id)?;
    let history_dir = chat_root(&app)?.join("history");
    fs::create_dir_all(&history_dir).map_err(|error| error.to_string())?;
    let path = history_dir.join(format!("{conversation_id}.json"));

    if payload.trim().is_empty() || payload.trim() == "[]" {
        if path.exists() {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
        return Ok(());
    }

    fs::write(path, payload).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn chat_clear_cache(app: AppHandle) -> Result<(), String> {
    let path = chat_root(&app)?;
    if path.exists() {
        fs::remove_dir_all(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}
