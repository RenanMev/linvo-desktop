use keyring::Entry;
use serde::{Deserialize, Serialize};

const SERVICE: &str = "com.linvo.desk";
const ACCESS_ACCOUNT: &str = "access_token";
const REFRESH_ACCOUNT: &str = "refresh_token";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredTokens {
    pub access_token: String,
    pub refresh_token: String,
}

fn access_entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCESS_ACCOUNT).map_err(|e| e.to_string())
}

fn refresh_entry() -> Result<Entry, String> {
    Entry::new(SERVICE, REFRESH_ACCOUNT).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn auth_set_tokens(access: String, refresh: String) -> Result<(), String> {
    access_entry()?
        .set_password(&access)
        .map_err(|e| e.to_string())?;
    refresh_entry()?
        .set_password(&refresh)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn auth_get_tokens() -> Result<Option<StoredTokens>, String> {
    let access = match access_entry() {
        Ok(entry) => match entry.get_password() {
            Ok(value) => value,
            Err(keyring::Error::NoEntry) => return Ok(None),
            Err(error) => return Err(error.to_string()),
        },
        Err(error) => return Err(error),
    };

    let refresh = match refresh_entry() {
        Ok(entry) => match entry.get_password() {
            Ok(value) => value,
            Err(keyring::Error::NoEntry) => {
                let _ = access_entry()
                    .and_then(|entry| entry.delete_credential().map_err(|e| e.to_string()));
                return Ok(None);
            }
            Err(error) => return Err(error.to_string()),
        },
        Err(error) => return Err(error),
    };

    Ok(Some(StoredTokens {
        access_token: access,
        refresh_token: refresh,
    }))
}

#[tauri::command]
pub fn auth_clear_tokens() -> Result<(), String> {
    if let Ok(entry) = access_entry() {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = refresh_entry() {
        let _ = entry.delete_credential();
    }
    Ok(())
}
