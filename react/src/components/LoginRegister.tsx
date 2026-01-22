import { useState } from "react"
import { LoginForm } from "./LoginForm"
import { RegisterForm } from "./RegisterForm"

type View = "buttons" | "login" | "register";

export const LoginRegister = () => {
  const [view, setView] = useState<View>("buttons");

  if (view === "login") {
    return <LoginForm onBack={ () => setView("buttons")} />;
  }

  if (view === "register") {
    return <RegisterForm onBack={ () => setView("buttons") }/>
  }

  <div className="login-register">
    <button 
      className="login-button"
      onClick={() => setView("login")}
    >
      Log In
    </button>
    <button 
      className="login-button"
      onClick={() => setView("register")}
    >
      Sign Up
    </button>
  </div>
}