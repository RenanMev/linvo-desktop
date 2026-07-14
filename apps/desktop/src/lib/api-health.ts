const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export type ApiHealthResult = {
  ok: boolean;
};

export async function checkApiHealth(): Promise<ApiHealthResult> {
  try {
    const response = await fetch(`${API_URL}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}
