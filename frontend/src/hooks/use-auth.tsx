import { createContext, useContext, useState, type ReactNode } from "react";
import { loginUser, registerUser } from "../utils/api";
import { mapAuthError } from "../utils/auth-errors";

export type UserStatus = "unknown" | "guest" | "member";

interface AuthContextType {
  userStatus: UserStatus;
  login: (username: string, password: string) => Promise<string | null>;
  register: (username: string, email: string, password: string) => Promise<string | null>;
  logout: () => void;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getInitialStatus(): UserStatus {
  const token = localStorage.getItem("accessToken");
  return token ? "member" : "unknown";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userStatus, setUserStatus] = useState<UserStatus>(getInitialStatus);

  async function login(username: string, password: string): Promise<string | null> {
    const response = await loginUser(username, password);
    if (response.ok && response.data) {
      localStorage.setItem("accessToken", response.data.access);
      localStorage.setItem("refreshToken", response.data.refresh);
      setUserStatus("member");
      return null;
    }
    return mapAuthError(response.status, response.data, "login");
  }

  async function register(username: string, email: string, password: string): Promise<string | null> {
    const response = await registerUser(username, email, password);
    if (response.ok) {
      // auto login after successful registration
      return await login(username, password);
    }
    return mapAuthError(response.status, response.data, "register");
  }

  function logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUserStatus("unknown");
  }

  function continueAsGuest() {
    setUserStatus("guest");
  }

  return (
    <AuthContext.Provider value={{ userStatus, login, register, logout, continueAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
