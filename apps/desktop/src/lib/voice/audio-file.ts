/*
 * Validação local do anexo de áudio (KAN-43), antes de subir: o mesmo teto e
 * os mesmos formatos da API, para o erro aparecer na hora e sem tráfego.
 */
export const AUDIO_ATTACHMENT_MAX_BYTES = 12 * 1024 * 1024;

export const AUDIO_ATTACHMENT_ACCEPT =
  ".ogg,.oga,.opus,.mp3,.m4a,.webm,.wav,audio/ogg,audio/mpeg,audio/mp4,audio/x-m4a,audio/webm,audio/wav";

const AUDIO_EXTENSIONS = new Set(["ogg", "oga", "opus", "mp3", "m4a", "webm", "wav"]);

export type AudioFileValidation =
  | { ok: true }
  | { ok: false; message: string };

export function validateAudioFile(file: File): AudioFileValidation {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const looksLikeAudio =
    file.type.startsWith("audio/") || AUDIO_EXTENSIONS.has(extension);
  if (!looksLikeAudio) {
    return {
      ok: false,
      message: "Formato inválido: use OGG, MP3 ou M4A (áudio do WhatsApp).",
    };
  }
  if (file.size === 0) {
    return { ok: false, message: "O arquivo de áudio está vazio." };
  }
  if (file.size > AUDIO_ATTACHMENT_MAX_BYTES) {
    return {
      ok: false,
      message: "Áudio acima de 12MB (cerca de 5 minutos).",
    };
  }
  return { ok: true };
}
