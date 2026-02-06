import "./App.css";
import { useState } from "react";
import { Daw } from "./components/Daw"
import { Logout } from "./components/Logout";
import { LoginForm } from "./components/LoginForm";
import { RegisterForm } from "./components/RegisterForm";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { AuthProvider, useAuth } from "./hooks/useAuth";

function AppContent() {
  const { userStatus, continueAsGuest, logout } = useAuth();
  const [view, setView] = useState<"welcome" | "login" | "register">("welcome");

  const showDaw = userStatus === "member" || userStatus === "guest";

  return (
    <>
      {!showDaw && view === "welcome" && (
        <WelcomeScreen
          onLogin={() => setView("login")}
          onRegister={() => setView("register")}
          onGuest={() => continueAsGuest()}
        />
      )}
      {!showDaw && view === "login" && (
        <LoginForm onBack={() => setView("welcome")} />
      )}
      {!showDaw && view === "register" && (
        <RegisterForm onBack={() => setView("welcome")} />
      )}
      {userStatus === "guest" && (
        <div className="guest-auth-buttons">
          <button onClick={() => { logout(); setView("login"); }} className="guest-auth-btn">
            Log In
          </button>
          <button onClick={() => { logout(); setView("register"); }} className="guest-auth-btn">
            Sign Up
          </button>
        </div>
      )}
      {userStatus === "member" && <Logout />}
      <div style={{ display: showDaw ? undefined : "none" }}>
        <Daw />
      </div>
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
