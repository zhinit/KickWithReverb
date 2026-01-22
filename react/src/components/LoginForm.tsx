import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

interface LoginFormProps {
  onBack: () => void;
}

export function LoginForm({onBack}: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const success = await login(username, password);
    if (!success) {
      setError("Invalid username or password");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Log In</h2>
      {error && <p className="error">{error}</p>}
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Log In</button>
      <button type="button" onClick={onBack}>Back</button>
    </form>
  )
}