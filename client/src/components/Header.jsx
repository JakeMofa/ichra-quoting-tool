/* // client/src/components/Header.jsx */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SettingsModal from './SettingsModal'; // gear popup

// ---- styles up top so ESLint sees them ----
const styles = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    borderBottom: '1px solid #1f2937',
    background: 'linear-gradient(180deg,#0b1220,#0b1220ee)',
    backdropFilter: 'blur(6px)',
  },
  brand: {
    fontWeight: 700,
    color: '#e5e7eb',
    textDecoration: 'none',
    letterSpacing: 0.2,
  },
  dot: { color: '#60a5fa' },
  right: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 },
  btn: {
    background: '#111827',
    color: '#e5e7eb',
    border: '1px solid #374151',
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  btnPrimary: { background: '#2563eb', borderColor: '#2563eb' },
  userWrap: { display: 'flex', gap: 10, alignItems: 'center' },
  userEmail: { color: '#9ca3af' },

  // modal
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'grid',
    placeItems: 'center',
    padding: 16,
    zIndex: 1000,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    background: '#0b1220',
    border: '1px solid #1f2937',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  },
  lbl: { display: 'block', color: '#9ca3af', marginBottom: 6, marginTop: 10, fontSize: 12 },
  input: {
    width: '100%',
    background: '#0f172a',
    color: '#e5e7eb',
    border: '1px solid #1f2937',
    borderRadius: 8,
    padding: '10px 12px',
  },
  muted: { color: '#9ca3af', fontSize: 12, marginTop: 8, lineHeight: 1.4 },
};

// ---- keep AuthModal in this file so it's defined ----
function AuthModal({ mode = 'login', onClose }) {
  const { login, signup } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');

  const onSubmit = (e) => {
    e.preventDefault();
    if (mode === 'login') {
      login(email, pw);
    } else {
      signup(email, pw);
    }
    onClose();
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>
          {mode === 'login' ? 'Log in' : 'Sign up'}
        </h3>
        <form onSubmit={onSubmit}>
          <label style={styles.lbl}>Email</label>
          <input
            style={styles.input}
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label style={styles.lbl}>Password</label>
          <input
            style={styles.input}
            type="password"
            placeholder="••••••••"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="submit"
              style={{ ...styles.btn, ...styles.btnPrimary, flex: 1 }}
            >
              {mode === 'login' ? 'Log in' : 'Create account'}
            </button>
            <button
              type="button"
              style={{ ...styles.btn, flex: 1 }}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>

          <p style={styles.muted}>
            Demo-only auth: we store email locally in your browser (no backend
            yet).
          </p>
        </form>
      </div>
    </div>
  );
}

// ---- Header with gear + SettingsModal + status chip ----
export default function Header() {
  const { user, logout, settings } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // chip text
  const modeLabel = settings?.mockMode
    ? 'Mock Mode'
    : settings?.ideonKey
    ? 'Ideon: ON'
    : 'Ideon: —';

  return (
    <>
      <header style={styles.header}>
        <Link to="/" style={styles.brand}>
          ICHRA Quoting Tool <span style={styles.dot}>•</span> Demo
        </Link>

        {/* status chip */}
        <span
          style={{
            marginLeft: 12,
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid #374151',
            background: '#111827',
            color: '#e5e7eb',
            fontSize: 12,
          }}
          title={
            settings?.mockMode
              ? 'Using local mock data'
              : settings?.ideonKey
              ? 'Using your Ideon key'
              : 'No key saved'
          }
        >
          {modeLabel}
        </span>

        <div style={styles.right}>
          <button
            style={styles.btn}
            onClick={() => setShowSettings(true)}
            title="Settings"
            aria-label="Open settings"
          >
            ⚙️
          </button>

          {!user ? (
            <>
              <button
                style={styles.btn}
                onClick={() => setShowLogin(true)}
              >
                Log in
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={() => setShowSignup(true)}
              >
                Sign up
              </button>
            </>
          ) : (
            <div style={styles.userWrap}>
              <span style={styles.userEmail}>{user.email}</span>
              <button style={styles.btn} onClick={logout}>
                Log out
              </button>
            </div>
          )}
        </div>
      </header>

      {showLogin && (
        <AuthModal mode="login" onClose={() => setShowLogin(false)} />
      )}
      {showSignup && (
        <AuthModal mode="signup" onClose={() => setShowSignup(false)} />
      )}
      {showSettings && (
        <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      )}
    </>
  );
}