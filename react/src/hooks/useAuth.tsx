import { createContext, useContext, useState, type ReactNode } from "react";
import { loginUser, registerUser } from "../utils/api"

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, email:string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: {children: ReactNode}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  async function login(username: string, password:string) {
    const response = await loginUser(username, password);
    if (response.ok) {
      const tokens = await response.json()
      localStorage.setItem("accessToken", tokens.access);
      localStorage.setItem("refreshToken", tokens.refresh);
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }

  async function register(username: string, email: string, password:string) {
    const response = await registerUser(username, email, password);
    if (response.ok) {
      // auto login after successful registration
      return await login(username, password);
    }
    return false;
  }

  function logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, register, logout }}>
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


