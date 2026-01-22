import { useAuth } from "../hooks/useAuth";

export function Logout() {
  const { logout } = useAuth();

  return (
    <button onClick={logout}>Log Out</button>
  );
}