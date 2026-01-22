interface LoginRegisterProps {
  onLogin: () => void;
  onRegister: () => void;
}

export const LoginRegister = ({ onLogin, onRegister }: LoginRegisterProps) => {
  return (
    <div className="login-register">
      <button className="login-button" onClick={onLogin}>Log In</button>
      <button className="login-button" onClick={onRegister}>Sign Up</button>
    </div>
  );
};