import "./App.css";
import { useEffect, useState } from "react";
import { Daw } from "./components/daw/Daw";
import { Logout } from "./components/auth/Logout";
import { LoginForm } from "./components/auth/LoginForm";
import { RegisterForm } from "./components/auth/RegisterForm";
import { AuthProvider, useAuth } from "./hooks/use-auth";

function AppContent() {
  const { userStatus } = useAuth();
  const [authForm, setAuthForm] = useState<"none" | "login" | "register">("none");

  // Auto-close auth form on successful login
  useEffect(() => {
    if (userStatus === "member") {
      setAuthForm("none");
    }
  }, [userStatus]);

  return (
    <>
      {authForm === "login" && (
        <LoginForm onBack={() => setAuthForm("none")} />
      )}
      {authForm === "register" && (
        <RegisterForm onBack={() => setAuthForm("none")} />
      )}
      {userStatus === "guest" && authForm === "none" && (
        <>
          <div className="guest-auth-buttons">
            <button
              onClick={() => setAuthForm("login")}
              className="guest-auth-btn"
            >
              Log In
            </button>
            <button
              onClick={() => setAuthForm("register")}
              className="guest-auth-btn"
            >
              Sign Up
            </button>
          </div>
          <div className="presets-bar-message">
            LOGIN FOR AI KICK GEN AND SAVING PRESETS
          </div>
        </>
      )}
      <div style={{ display: authForm === "none" ? undefined : "none" }}>
        <Daw />
      </div>
      {userStatus === "member" && <Logout />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
