import "./presets-bar.css";
import "../ui/modal.css";
import { useState } from "react";
import type { PresetItem } from "../../hooks/use-presets";

interface PresetsBarProps {
  isMember: boolean;
  presets: PresetItem[];
  currentPresetId: number | null;
  currentPresetName: string;
  canDelete: boolean;
  onLoadPreset: (id: number) => void;
  onSave: (name: string) => Promise<{ ok: boolean; error?: string }>;
  onDelete: () => Promise<{ ok: boolean; error?: string }>;
  onNext: () => void;
  onPrev: () => void;
}

export const PresetsBar = ({
  isMember,
  presets,
  currentPresetId,
  currentPresetName,
  canDelete,
  onLoadPreset,
  onSave,
  onDelete,
  onNext,
  onPrev,
}: PresetsBarProps) => {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [sharedMessage, setSharedMessage] = useState("");

  // Handle dropdown change
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value, 10);
    if (!isNaN(id)) {
      onLoadPreset(id);
    }
  };

  // Handle save button click
  const handleSaveClick = () => {
    if (!isMember) {
      setSharedMessage("Please log in");
      return;
    }
    setSaveName(currentPresetName === "Unsaved" ? "" : currentPresetName);
    setSaveError("");
    setShowSaveModal(true);
  };

  // Handle save form submit
  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate name
    const trimmedName = saveName.trim();
    if (!trimmedName) {
      setSaveError("Name is required");
      return;
    }
    if (trimmedName.length > 32) {
      setSaveError("Name must be 32 characters or less");
      return;
    }
    if (!/^[a-zA-Z0-9 ]+$/.test(trimmedName)) {
      setSaveError("Name can only contain letters, numbers, and spaces");
      return;
    }

    // Check if name matches a shared preset
    const isSharedName = presets.some(
      (p) => p.isShared && p.presetName === trimmedName
    );
    if (isSharedName) {
      setShowSaveModal(false);
      setSharedMessage("Cannot update shared presets");
      return;
    }

    const result = await onSave(trimmedName);
    if (result.ok) {
      setShowSaveModal(false);
    } else {
      setSaveError(result.error || "Failed to save preset");
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    await onDelete();
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div className="presets-bar">
        <button
          className="presets-bar-btn"
          onClick={onPrev}
          title="Previous preset"
        >
          ⇇
        </button>
        <button
          className="presets-bar-btn"
          onClick={onNext}
          title="Next preset"
        >
          ⇉
        </button>

        <select
          className="presets-bar-select"
          value={currentPresetId ?? ""}
          onChange={handleSelectChange}
        >
          {presets.length === 0 ? (
            <option value="">No presets yet</option>
          ) : (
            <>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.presetName}
                </option>
              ))}
            </>
          )}
        </select>

        <button
          className="presets-bar-btn"
          onClick={() => {
            if (!isMember) {
              setSharedMessage("Please log in");
            } else if (!canDelete) {
              setSharedMessage("Cannot delete shared presets");
            } else {
              setShowDeleteConfirm(true);
            }
          }}
          title="Delete preset"
        >
          🗑️
        </button>
        <button
          className="presets-bar-btn"
          onClick={handleSaveClick}
          title="Save preset"
        >
          💾
        </button>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Save Preset</h3>
            <form onSubmit={handleSaveSubmit}>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Preset name"
                maxLength={32}
                autoFocus
              />
              {saveError && <p className="modal-error">{saveError}</p>}
              <div className="modal-buttons">
                <button type="button" onClick={() => setShowSaveModal(false)}>
                  Cancel
                </button>
                <button type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Preset</h3>
            <p>Are you sure you want to delete "{currentPresetName}"?</p>
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

      {/* Shared Preset Info Modal */}
      {sharedMessage && (
        <div
          className="modal-overlay"
          onClick={() => setSharedMessage("")}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p>{sharedMessage}</p>
            <div className="modal-buttons">
              <button onClick={() => setSharedMessage("")}>OK</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
