interface WelcomeScreenProps {
  onLogin: () => void;
  onRegister: () => void;
  onGuest: () => void;
}

export const WelcomeScreen = ({ onLogin, onRegister, onGuest }: WelcomeScreenProps) => {
  return (
    <div className="welcome-screen">
      <h1 className="welcome-title">KICK WITH REVERB</h1>
      <p className="welcome-prompt">Welcome to the Loop. What would you like to do?</p>
      <div className="welcome-buttons">
        <button className="welcome-btn" onClick={onLogin}>Login</button>
        <button className="welcome-btn" onClick={onRegister}>Sign Up</button>
        <button className="welcome-btn" onClick={onGuest}>Continue as Guest</button>
      </div>
    </div>
  );
};
