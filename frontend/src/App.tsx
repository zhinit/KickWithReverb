import "./App.css";
import { useEffect, useState } from "react";

// components
import { Daw } from "./components/daw/Daw";
import { Logout } from "./components/auth/Logout";
import { LoginForm } from "./components/auth/LoginForm";
import { RegisterForm } from "./components/auth/RegisterForm";

// custom hooks
import { AuthProvider, useAuth } from "./hooks/use-auth";

// Content For App Component
function AppContent() {
  const { userStatus } = useAuth();
  const [authForm, setAuthForm] = useState<"none" | "login" | "register">(
    "none"
  );

  // Auto-close auth form on successful login
  useEffect(() => {
    if (userStatus === "member") {
      setAuthForm("none");
    }
  }, [userStatus]);

  return (
    <>
      {authForm === "login" && <LoginForm onBack={() => setAuthForm("none")} />}
      {authForm === "register" && (
        <RegisterForm onBack={() => setAuthForm("none")} />
      )}
      {authForm === "none" && userStatus === "guest" && (
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
      {authForm === "none" && <Daw />}
      {userStatus === "member" && <Logout />}
    </>
  );
}

// App Component
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
