import {
  desktopReleaseResponseSchema,
  type DesktopReleaseResponse,
} from "@linvo/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function fetchDesktopRelease(): Promise<DesktopReleaseResponse> {
  const response = await fetch(`${API_URL}/api/desktop/release`, {
    method: "GET",
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar release (${response.status})`);
  }

  return desktopReleaseResponseSchema.parse(await response.json());
}
