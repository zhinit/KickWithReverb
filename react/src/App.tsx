import "./App.css";
import { useState } from "react";
import { Daw } from "./components/Daw"
import { Logout } from "./components/Logout";
import { LoginForm } from "./components/LoginForm";
import { RegisterForm } from "./components/RegisterForm";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { AuthProvider, useAuth } from "./hooks/useAuth";

function AppContent() {
  const { userStatus, continueAsGuest } = useAuth();
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
      <div style={{ display: showDaw ? undefined : "none" }}>
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
