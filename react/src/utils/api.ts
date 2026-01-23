const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number | null;
  data: T | null;
}

export async function loginUser(
  username: string,
  password: string
): Promise<ApiResponse<{ access: string; refresh: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: null, data: null };
  }
}

export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<ApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: null, data: null };
  }
}
