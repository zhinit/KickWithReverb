import "./App.css";
import { Daw } from "./components/Daw"
import { LoginRegister } from "./components/LoginRegister";
import { Logout } from "./components/Logout";
import { AuthProvider, useAuth } from "./hooks/useAuth";

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {!isAuthenticated && <LoginRegister />}
      <Daw />
      {isAuthenticated && <Logout />}
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
