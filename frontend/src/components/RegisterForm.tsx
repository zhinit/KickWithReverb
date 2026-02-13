import { useState } from "react";
import { useAuth } from "../hooks/use-auth";

interface LoginFormProps {
  onBack: () => void;
}

export function RegisterForm({ onBack }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { register } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const errorMessage = await register(username, email, password);
    if (errorMessage) {
      setError(errorMessage);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="form-header">Create System Persona</h3>
      {error && <p className="error">{error}</p>}
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Sign Up</button>
      <button type="button" onClick={onBack}>
        Back
      </button>
    </form>
  );
}
