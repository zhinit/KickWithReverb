import type { PresetData } from "../types/preset";
import type { KickListResponse, GenerateKickResponse } from "../types/gen-kick";
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number | null;
  data: T | null;
}

// Refresh access token
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/api/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem("accessToken", data.access);
      return true;
    }
  } catch {
    // Refresh failed
  }

  // Clear tokens if refresh failed
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  return false;
}

// wrapper for fetch using access tokens
async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const makeRequest = (token: string | null) => {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  };

  // First attempt with current token
  let token = localStorage.getItem("accessToken");
  let response = await makeRequest(token);

  // If unauthorized, try to refresh and retry
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      token = localStorage.getItem("accessToken");
      response = await makeRequest(token);
    }
  }

  return response;
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

export async function createPreset(
  preset: Omit<PresetData, "id" | "createdAt" | "updatedAt">,
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
  preset: Partial<Omit<PresetData, "id" | "createdAt" | "updatedAt">>,
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

export async function getKicks(): Promise<ApiResponse<KickListResponse>> {
  try {
    const response = await authenticatedFetch("/api/kicks/");
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: null, data: null };
  }
}

export async function generateKick(): Promise<ApiResponse<GenerateKickResponse>> {
  try {
    const response = await authenticatedFetch("/api/kicks/generate/", {
      method: "POST",
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: null, data: null };
  }
}

export async function deleteKick(
  id: number,
  confirm = false,
): Promise<ApiResponse> {
  try {
    const query = confirm ? "?confirm=true" : "";
    const response = await authenticatedFetch(`/api/kicks/${id}/${query}`, {
      method: "DELETE",
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: null, data: null };
  }
}

export async function loginUser(
  username: string,
  password: string,
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
  password: string,
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
