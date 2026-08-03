use std::path::PathBuf;

/// Grava o PDF no caminho que o usuário escolheu no diálogo "Salvar como".
///
/// É um comando próprio em vez do `tauri-plugin-fs` porque o plugin exige um
/// escopo declarado em build time; aqui o destino só existe depois do diálogo,
/// e abrir a home inteira para escrita seria pagar caro por um único arquivo.
#[tauri::command]
pub async fn documents_save_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    let target = PathBuf::from(&path);

    if let Some(parent) = target.parent() {
        if !parent.exists() {
            return Err(format!("pasta não encontrada: {}", parent.display()));
        }
    }

    tauri::async_runtime::spawn_blocking(move || std::fs::write(&target, &contents))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}
