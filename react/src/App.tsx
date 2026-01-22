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

  if (!isAuthenticated) {
    if (view === "login") {
      return <LoginForm onBack={() => setView("main")} />;
    }
    if (view === "register") {
      return <RegisterForm onBack={() => setView("main")} />;
    }
    // main view - buttons + daw
    return (
      <>
        <LoginRegister
          onLogin={() => setView("login")}
          onRegister={() => setView("register")}
        />
        <Daw />
      </>
    );
  }

  // logged in - daw + logout at bottom
  return (
    <>
      <Daw />
      <Logout />
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
