import "./loading-overlay.css";

interface LoadingOverlayProps {
  isReady: boolean;
  onFaded: () => void;
}

export const LoadingOverlay = ({ isReady, onFaded }: LoadingOverlayProps) => {
  return (
    <div
      className={`loading-overlay${isReady ? " loading-overlay--fading" : ""}`}
      onTransitionEnd={onFaded}
    >
      <div className="loading-content">
        <svg width="300" height="90" viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="loadingFadeEdges" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity={0} />
              <stop offset="10%" stopColor="white" stopOpacity={1} />
              <stop offset="90%" stopColor="white" stopOpacity={1} />
              <stop offset="100%" stopColor="white" stopOpacity={0} />
            </linearGradient>
            <mask id="loadingScopeMask">
              <rect x="0" y="0" width="400" height="120" fill="url(#loadingFadeEdges)" />
            </mask>
          </defs>
          <line x1="0" y1="60" x2="400" y2="60" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <g mask="url(#loadingScopeMask)">
            <path
              className="loading-wave-path"
              fill="none"
              stroke="whitesmoke"
              strokeWidth="2"
              strokeLinejoin="miter"
              strokeLinecap="butt"
              d="
                M 0 60
                L 50 60 L 52 10 L 55 110 L 58 20 L 62 100 L 67 35 L 75 85 L 85 45 L 100 70 L 130 55 L 160 60
                L 400 60
                L 450 60 L 452 10 L 455 110 L 458 20 L 462 100 L 467 35 L 475 85 L 485 45 L 500 70 L 530 55 L 560 60
                L 800 60
              "
            />
          </g>
        </svg>
        <p className="loading-text">Loading...</p>
      </div>
    </div>
  );
};
