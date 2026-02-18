import "./presets-bar.css";
import "../ui/modal.css";
import { useState } from "react";
import type { KickData } from "../../types/gen-kick";

interface KickGenBarProps {
  aiKicks: KickData[];
  selectedKickId: number | null;
  onSelectKick: (id: number) => void;
  onGenerate: () => Promise<{ ok: boolean; error?: string; kick?: KickData }>;
  onDelete: (
    id: number,
    confirm?: boolean
  ) => Promise<{
    ok: boolean;
    status?: number;
    error?: string;
    presets?: string[];
  }>;
  isGenerating: boolean;
  remainingGensToday: number;
  totalGensCount: number;
}

export const KickGenBar = ({
  aiKicks,
  selectedKickId,
  onSelectKick,
  onGenerate,
  onDelete,
  isGenerating,
  remainingGensToday,
  totalGensCount,
}: KickGenBarProps) => {
  const [message, setMessage] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [affectedPresets, setAffectedPresets] = useState<string[]>([]);

  const selectedKick = aiKicks.find((k) => k.id === selectedKickId);
  const selectedIndex = aiKicks.findIndex((k) => k.id === selectedKickId);

  const handlePrev = () => {
    if (aiKicks.length === 0) return;
    const prevIndex =
      selectedIndex <= 0 ? aiKicks.length - 1 : selectedIndex - 1;
    onSelectKick(aiKicks[prevIndex].id);
  };

  const handleNext = () => {
    if (aiKicks.length === 0) return;
    const nextIndex =
      selectedIndex >= aiKicks.length - 1 ? 0 : selectedIndex + 1;
    onSelectKick(aiKicks[nextIndex].id);
  };

  const handleGenerate = async () => {
    setMessage("");

    if (totalGensCount >= 30) {
      setMessage("Delete kicks to generate more (30/30)");
      return;
    }

    const result = await onGenerate();
    if (!result.ok) {
      setMessage(result.error ?? "Generation failed");
    }
  };

  const selectAfterDelete = () => {
    const remaining = aiKicks.filter((k) => k.id !== selectedKickId);
    if (remaining.length === 0) {
      onSelectKick(0); // clears selection (no valid id)
      return;
    }
    // Pick next in list, or previous if we deleted the last one
    const nextIndex = Math.min(selectedIndex, remaining.length - 1);
    onSelectKick(remaining[nextIndex].id);
  };

  const handleDelete = async () => {
    if (!selectedKickId) return;
    setMessage("");

    const result = await onDelete(selectedKickId);

    if (result.status === 409 && result.presets) {
      setAffectedPresets(result.presets);
      setShowDeleteConfirm(true);
      return;
    }

    if (!result.ok) {
      setMessage(result.error ?? "Delete failed");
      return;
    }

    selectAfterDelete();
  };

  const handleDeleteConfirm = async () => {
    if (!selectedKickId) return;
    setShowDeleteConfirm(false);

    const result = await onDelete(selectedKickId, true);
    if (!result.ok) {
      setMessage(result.error ?? "Delete failed");
      return;
    }

    selectAfterDelete();
  };

  return (
    <>
      <div className="presets-bar">
        <button
          className="presets-bar-btn"
          onClick={handlePrev}
          title="Previous kick"
        >
          ⇇
        </button>
        <button
          className="presets-bar-btn"
          onClick={handleNext}
          title="Next kick"
        >
          ⇉
        </button>

        <select
          className="presets-bar-select"
          value={selectedKickId ?? ""}
          onChange={(e) => {
            const id = parseInt(e.target.value, 10);
            if (!isNaN(id)) onSelectKick(id);
          }}
        >
          {aiKicks.length === 0 ? (
            <option value="">Click 🎨 to generate new kick</option>
          ) : (
            aiKicks.map((kick) => (
              <option key={kick.id} value={kick.id}>
                {kick.name}
              </option>
            ))
          )}
        </select>

        <button
          className="presets-bar-btn"
          onClick={handleDelete}
          disabled={!selectedKickId}
          title="Delete selected kick"
        >
          🗑️
        </button>
        <button
          className="presets-bar-btn"
          onClick={handleGenerate}
          disabled={isGenerating}
          title="Generate new AI kick"
        >
          {isGenerating ? "..." : "GEN"}
        </button>
      </div>

      {message && <div className="kickgen-message">{message}</div>}

      {isGenerating && (
        <div className="kickgen-message">generating from the ether...</div>
      )}

      {remainingGensToday <= 3 && remainingGensToday > 0 && (
        <div className="kickgen-message">
          {remainingGensToday} kick generation
          {remainingGensToday !== 1 ? "s" : ""} left until 12:00 AM EST
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Kick</h3>
            <p>
              Deleting "{selectedKick?.name}" will also delete these presets:
            </p>
            <ul>
              {affectedPresets.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <div className="modal-buttons">
              <button onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="modal-btn-danger"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
