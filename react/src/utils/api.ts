const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function loginUser(username: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return response;
}

export async function registerUser(
  username: string,
  email: string,
  password: string
) {
  const response = await fetch(`${API_BASE_URL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  return response;
}
