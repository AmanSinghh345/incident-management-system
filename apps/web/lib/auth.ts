import { API_BASE_URL } from "./api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  workspaceSlug: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

const TOKEN_KEY = "pulseops.accessToken";

export async function login(email: string, password: string) {
  return authRequest("/auth/login", { email, password });
}

export async function register(name: string, email: string, password: string) {
  return authRequest("/auth/register", { name, email, password });
}

export function saveAccessToken(accessToken: string) {
  window.localStorage.setItem(TOKEN_KEY, accessToken);
}

export function getAccessToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearAccessToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

async function authRequest(path: string, body: unknown): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readErrorMessage(data, "Authentication failed."));
  }

  return data as AuthResponse;
}

function readErrorMessage(data: unknown, fallback: string) {
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string"
  ) {
    return data.message;
  }

  return fallback;
}
