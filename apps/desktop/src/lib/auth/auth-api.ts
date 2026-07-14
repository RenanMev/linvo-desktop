import {
  authResultSchema,
  authTokensSchema,
  type AuthResult,
  type LoginInput,
  type RegisterInput,
  type UserPublic,
} from "@linvo/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class AuthApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

export class AuthNetworkError extends Error {
  constructor(message = "Não foi possível conectar à API") {
    super(message);
    this.name = "AuthNetworkError";
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message[0] ?? "Erro inesperado";
    }
    if (typeof body.message === "string") {
      return body.message;
    }
  } catch {
    return "Erro inesperado";
  }
  return "Erro inesperado";
}

async function request<T>(
  path: string,
  init?: RequestInit,
  parser?: (data: unknown) => T,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new AuthNetworkError();
  }

  if (!response.ok) {
    throw new AuthApiError(await parseErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();
  return parser ? parser(data) : (data as T);
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  }, (data) => authResultSchema.parse(data));
}

export async function login(input: LoginInput): Promise<AuthResult> {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  }, (data) => authResultSchema.parse(data));
}

export async function refresh(refreshToken: string) {
  return request(
    "/api/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    },
    (data) => authTokensSchema.parse(data),
  );
}

export async function logout(refreshToken: string): Promise<void> {
  try {
    await request("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  } catch (error) {
    if (error instanceof AuthNetworkError) {
      return;
    }
    throw error;
  }
}

export async function me(accessToken: string): Promise<UserPublic> {
  const data = await request(
    "/api/auth/me",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    (payload) => {
      const parsed = payload as { user: UserPublic };
      return parsed.user;
    },
  );
  return data;
}
