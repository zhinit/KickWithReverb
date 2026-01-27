import "./App.css";
import { useState } from "react";
import { Daw } from "./components/Daw"
import { LoginRegister } from "./components/LoginRegister";
import { Logout } from "./components/Logout";
import { LoginForm } from "./components/LoginForm";
import { RegisterForm } from "./components/RegisterForm";
import { AuthProvider, useAuth } from "./hooks/useAuth";

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [view, setView] = useState<"main" | "login" | "register">("main");

  const showDaw = isAuthenticated || view === "main";

  return (
    <>
      {!isAuthenticated && view === "login" && (
        <LoginForm onBack={() => setView("main")} />
      )}
      {!isAuthenticated && view === "register" && (
        <RegisterForm onBack={() => setView("main")} />
      )}
      {!isAuthenticated && view === "main" && (
        <LoginRegister
          onLogin={() => setView("login")}
          onRegister={() => setView("register")}
        />
      )}
      <div style={{ display: showDaw ? undefined : "none" }}>
        <Daw />
      </div>
      {isAuthenticated && <Logout />}
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
