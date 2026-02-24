import { createContext, useContext, useState, type ReactNode } from "react";
import { loginUser, registerUser } from "../utils/api";
import { mapAuthError } from "../utils/auth-errors";

export type UserStatus = "guest" | "member";

interface AuthContextType {
  userStatus: UserStatus;
  login: (username: string, password: string) => Promise<string | null>;
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// when a user opens the app we check if they have an access token. if so we mark them as a member
function getInitialStatus(): UserStatus {
  const token = localStorage.getItem("accessToken");
  return token ? "member" : "guest";
}

// Context.Provider for App component
// provides userStatus state to entire app
// note that login, register and logout are in here because they change userStatus state
export function AuthProvider({ children }: { children: ReactNode }) {
  const [userStatus, setUserStatus] = useState<UserStatus>(getInitialStatus);

  // function which calls api login function
  async function login(
    username: string,
    password: string
  ): Promise<string | null> {
    const response = await loginUser(username, password);
    if (response.ok && response.data) {
      // if login is valid, set tokens and user status
      localStorage.setItem("accessToken", response.data.access);
      localStorage.setItem("refreshToken", response.data.refresh);
      setUserStatus("member");
      return null;
    }
    // if login is valid return appropriate error
    return mapAuthError(response.status, response.data, "login");
  }

  // function which calls api register function
  async function register(
    username: string,
    email: string,
    password: string
  ): Promise<string | null> {
    const response = await registerUser(username, email, password);
    if (response.ok) {
      // auto login after successful registration
      return await login(username, password);
    }
    // if registration fails, return an appropriate error
    return mapAuthError(response.status, response.data, "register");
  }

  // log out removes tokens and changes use status to guest. note no api call needed
  function logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUserStatus("guest");
  }

  return (
    <AuthContext.Provider value={{ userStatus, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// convient helper function to get auth context anyweher in the app
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
