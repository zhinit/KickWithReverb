import type { PresetData } from "../types/preset";
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number | null;
  data: T | null;
}

async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem("accessToken");

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
}

export async function getPresets(): Promise<ApiResponse<PresetData[]>> {
  try {
    const response = await authenticatedFetch("/api/presets/");
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: null, data: null };
  }
}

export async function getSharedPresets(): Promise<ApiResponse<PresetData[]>> {
  try {
    const response = await authenticatedFetch("/api/presets/shared/");
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: null, data: null };
  }
}

export async function createPreset(
  preset: Omit<PresetData, "id" | "createdAt" | "updatedAt">
): Promise<ApiResponse<PresetData>> {
  try {
    const response = await authenticatedFetch("/api/presets/", {
      method: "POST",
      body: JSON.stringify(preset),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: null, data: null };
  }
}

export async function updatePreset(
  id: number,
  preset: Partial<Omit<PresetData, "id" | "createdAt" | "updatedAt">>
): Promise<ApiResponse<PresetData>> {
  try {
    const response = await authenticatedFetch(`/api/presets/${id}/`, {
      method: "PUT",
      body: JSON.stringify(preset),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: null, data: null };
  }
}

export async function deletePreset(id: number): Promise<ApiResponse<null>> {
  try {
    const response = await authenticatedFetch(`/api/presets/${id}/`, {
      method: "DELETE",
    });
    return { ok: response.ok, status: response.status, data: null };
  } catch {
    return { ok: false, status: null, data: null };
  }
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
