"use client";

interface DeathSceneModalProps {
  message: string;
  onDismiss: () => void;
}

export function DeathSceneModal({ message, onDismiss }: DeathSceneModalProps) {
  return (
    <div className="supply-picker-overlay">
      <div className="supply-picker-modal retro-box death-scene-modal">
        <p className="retro-box-title">Death</p>
        <p className="retro-muted">{message}</p>
        <div className="supply-picker-actions">
          <button type="button" className="candy-btn" onClick={onDismiss}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
