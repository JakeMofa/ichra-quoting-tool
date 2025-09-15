// client/src/components/SettingsModal.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/settings.css"; // we'll create this next

export default function SettingsModal({ open, onClose }) {
  const { settings, setSettings } = useAuth();
  const [mockMode, setMockMode] = useState(settings?.mockMode ?? true);
  const [ideonKey, setIdeonKey] = useState(settings?.ideonKey ?? "");

  useEffect(() => {
    if (open) {
      setMockMode(settings?.mockMode ?? true);
      setIdeonKey(settings?.ideonKey ?? "");
    }
  }, [open, settings]);

  if (!open) return null;

  const save = () => {
    setSettings({ mockMode, ideonKey: ideonKey.trim() });
    onClose();
  };

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Settings</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="settings-body">
          <label className="toggle">
            <input
              type="checkbox"
              checked={mockMode}
              onChange={(e) => setMockMode(e.target.checked)}
            />
            <span>Use Mock Mode (no Ideon API calls)</span>
          </label>

          <div className="field">
            <label>Ideon API Key</label>
            <input
              type="password"
              value={ideonKey}
              onChange={(e) => setIdeonKey(e.target.value)}
              disabled={mockMode}
              placeholder="ideon_***"
            />
            <p className="muted">
              Leave empty to stay in Mock Mode. If provided and Mock Mode is off,
              your key will be used for live flows.
            </p>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}