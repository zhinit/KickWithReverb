import { useAuth } from "../hooks/use-auth";

export function Logout() {
  const { logout } = useAuth();

  return (
    <div className="logout-button-border">
      <button onClick={logout} className="logout-button">
        Log Out
      </button>
    </div>
  );
}
