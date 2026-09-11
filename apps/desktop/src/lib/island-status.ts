export type IslandStatus =
  | "offline"
  | "session-expired"
  | "api-down"
  | "thinking"
  | "listening"
  | "online";

export type IslandStatusInput = {
  floatingReady: boolean;
  apiHealthy: boolean;
  sessionWarning: string | null;
  isThinking?: boolean;
  isListening?: boolean;
};

export function deriveIslandStatus({
  floatingReady,
  apiHealthy,
  sessionWarning,
  isThinking = false,
  isListening = false,
}: IslandStatusInput): IslandStatus {
  if (!floatingReady) {
    return "offline";
  }
  if (sessionWarning) {
    return "session-expired";
  }
  if (!apiHealthy) {
    return "api-down";
  }
  if (isThinking) {
    return "thinking";
  }
  if (isListening) {
    return "listening";
  }
  return "online";
}

export function islandStatusLabel(status: IslandStatus): string {
  switch (status) {
    case "session-expired":
      return "Sessão expirada";
    case "api-down":
      return "API indisponível";
    case "thinking":
      return "Pensando";
    case "listening":
      return "Ouvindo";
    case "online":
      return "Online";
    case "offline":
      return "Sistema inativo";
  }
}

export function islandStatusLive(status: IslandStatus): boolean {
  return status === "online" || status === "thinking" || status === "listening";
}
