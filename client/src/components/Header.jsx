/* // client/src/components/Header.jsx */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SettingsModal from './SettingsModal';

// ---- styles ----
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
  brand: { fontWeight: 700, color: '#e5e7eb', textDecoration: 'none', letterSpacing: 0.2 },
  dot: { color: '#60a5fa' },
  right: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 },
  btn: {
    background: '#111827', color: '#e5e7eb', border: '1px solid #374151',
    padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
  },
  btnPrimary: { background: '#2563eb', borderColor: '#2563eb' },
  userWrap: { display: 'flex', gap: 10, alignItems: 'center' },
  userName: { color: '#9ca3af' },
  // modal
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'grid', placeItems: 'center', padding: 16, zIndex: 1000,
  },
  modal: {
    width: '100%', maxWidth: 520, background: '#0b1220',
    border: '1px solid #1f2937', borderRadius: 16, padding: 22,
    boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
  },
  lbl: { display: 'block', color: '#9ca3af', marginBottom: 6, marginTop: 10, fontSize: 12 },
  input: {
    width: '100%', background: '#0f172a', color: '#e5e7eb',
    border: '1px solid #1f2937', borderRadius: 8, padding: '10px 12px',
  },
  muted: { color: '#9ca3af', fontSize: 12, marginTop: 8, lineHeight: 1.4 },
};

// Scoped keyframes (no external libs)
const kf = `
@keyframes floaty { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-6px) } }
@keyframes glow { 0%,100%{ box-shadow: 0 0 0px rgba(96,165,250,.0) } 50%{ box-shadow: 0 0 24px rgba(96,165,250,.35) } }
@keyframes pop { 0%{ transform: scale(.9); opacity: 0 } 100%{ transform: scale(1); opacity: 1 } }
@keyframes dots { 0%{ content: '' } 33%{ content: '.' } 66%{ content: '..' } 100%{ content: '...' } }
@keyframes wiggle { 0%{ transform: rotate(0deg) } 25%{ transform: rotate(-8deg) } 50%{ transform: rotate(6deg) } 75%{ transform: rotate(-4deg) } 100%{ transform: rotate(0deg) } }
@keyframes shimmer { 
  0%{ background-position: -200% 0 }
  100%{ background-position: 200% 0 }
}
.splashCard { animation: floaty 4.2s ease-in-out infinite, glow 2.8s ease-in-out infinite; }
.splashTitle { animation: pop .35s ease both; }
.checkBadge { display:inline-block; transform-origin: center; animation: pop .25s ease both; }
.tool { display:inline-block; animation: wiggle 1.4s ease-in-out infinite; }
.dots::after { display:inline-block; min-width: 1.5ch; animation: dots 1.2s steps(3,end) infinite; content: '' }
.loginStripe {
  background: linear-gradient(90deg, rgba(37,99,235,.15), rgba(96,165,250,.15), rgba(37,99,235,.15));
  background-size: 200% 100%;
  animation: shimmer 2.2s linear infinite;
  border-radius: 10px;
  height: 8px;
}
`;

/* ---------------- Welcome splash (animated) ---------------- */
function WelcomeSplash({ name, onDone }) {
  const boxRef = useRef(null);
  const [dotsTick, setDotsTick] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // subtle entrance
    el.style.opacity = 0; el.style.transform = 'translateY(6px)';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 260ms ease, transform 260ms ease';
      el.style.opacity = 1; el.style.transform = 'translateY(0)';
    });

    // manual dots tick (cosmetic)
    const tick = setInterval(() => setDotsTick((n) => (n + 1) % 4), 450);
    const t = setTimeout(onDone, 2600);
    return () => { clearTimeout(t); clearInterval(tick); };
  }, [onDone]);

  const dotStr = '.'.repeat(dotsTick);

  return (
    <>
      <style>{kf}</style>
      <div style={styles.backdrop}>
        <div
          ref={boxRef}
          className="splashCard"
          style={{ ...styles.modal, textAlign: 'center', paddingTop: 26, paddingBottom: 26 }}
        >
          <div style={{ fontSize: 16, marginBottom: 10, color: '#93c5fd' }}>
            Verified <span className="checkBadge">✅</span>
          </div>

          <div className="splashTitle" style={{ fontSize: 26, fontWeight: 800, marginBottom: 10 }}>
            Welcome to the ICHRA Quoting Tool Demo
          </div>

          <div style={{ color: '#9ca3af', fontSize: 15 }}>
            Hi{ name ? `, ${name}` : ''}. Loading your workspace
            <span className="dots" aria-hidden="true" />
            <span style={{ position: 'absolute', opacity: 0 }}>{dotStr}</span>
            &nbsp;<span className="tool" role="img" aria-label="tool">🛠️</span>
          </div>

          <div className="loginStripe" style={{ marginTop: 14 }} />
        </div>
      </div>
    </>
  );
}

/* ---------------- Goodbye (logout) popup ---------------- */
function GoodbyeModal({ name = '', onDone }) {
  const boxRef = useRef(null);
  const [dots, setDots] = useState('.');

  useEffect(() => {
    const el = boxRef.current;
    if (el) {
      el.style.opacity = 0; el.style.transform = 'scale(.96)';
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 220ms ease, transform 220ms ease';
        el.style.opacity = 1; el.style.transform = 'scale(1)';
      });
    }
    const int = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '.' : d + '.'));
    }, 350);
    const t = setTimeout(onDone, 1400);
    return () => { clearInterval(int); clearTimeout(t); };
  }, [onDone]);

  return (
    <div style={styles.backdrop}>
      <div ref={boxRef} style={{ ...styles.modal, textAlign: 'center', paddingTop: 24, paddingBottom: 24 }}>
        <div style={{ fontSize: 18, marginBottom: 6, color: '#93c5fd' }}>Logging out 👋</div>
        <div style={{ fontSize: 16, color: '#9ca3af' }}>
          {name ? `Thanks for your session, ${name}.` : 'Thanks for your session.'}
        </div>
        <div style={{ marginTop: 8, fontWeight: 600 }}>
          Closing your workspace{dots}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Logging-in popup (animated) ---------------- */
function LoggingInModal({ name, email, onDone }) {
  const boxRef = useRef(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.opacity = 0; el.style.transform = 'scale(.97)';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 240ms ease, transform 240ms ease';
      el.style.opacity = 1; el.style.transform = 'scale(1)';
    });
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <>
      <style>{kf}</style>
      <div style={styles.backdrop}>
        <div ref={boxRef} className="splashCard" style={{ ...styles.modal, textAlign: 'center' }}>
          <div style={{ fontSize: 16, marginBottom: 8, color: '#93c5fd' }}>Logging you in…</div>
          <div className="splashTitle" style={{ fontSize: 22, fontWeight: 700 }}>
            Thanks for coming back <span role="img" aria-label="wave">👋</span>
          </div>
          <div style={{ color: '#9ca3af', marginTop: 8 }}>
            Hi, {name || email}. Loading your workspace<span className="dots" />
            &nbsp;<span className="tool" role="img" aria-label="tool">🛠️</span>
          </div>
          <div className="loginStripe" style={{ marginTop: 14 }} />
        </div>
      </div>
    </>
  );
}

/* ---------------- Verify code after signup (pre-DB) ---------------- */
function VerifySignupModal({ pending, onClose }) {
  // pending = { email, password, firstName, lastName }
  const { requestSignupCode, verifySignupCode } = useAuth(); // server will create user on verify
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const sentOnceRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (sentOnceRef.current) return;
    sentOnceRef.current = true;
    (async () => { try { await requestSignupCode(pending.email); } catch {} })();
  }, [pending.email, requestSignupCode]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await verifySignupCode({
        email: pending.email,
        code,
        firstName: pending.firstName,
        lastName: pending.lastName,
        password: pending.password,
      });
      setShowWelcome(true);
    } catch (ex) {
      setErr(ex?.message || 'Invalid or expired code');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setErr(''); setBusy(true);
    try { await requestSignupCode(pending.email); }
    catch (ex) { setErr(ex?.message || 'Could not send a new code'); }
    finally { setBusy(false); }
  };

  if (showWelcome) {
    const displayName = [pending.firstName, pending.lastName].filter(Boolean).join(' ');
    return <WelcomeSplash name={displayName} onDone={() => { onClose(); navigate('/groups'); }} />;
  }

  return (
    <>
      <style>{kf}</style>
      <div style={styles.backdrop} onClick={onClose}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Verify your email</h3>
          <p style={styles.muted}>We sent a 6-digit code to <strong>{pending.email}</strong>.</p>
          <form onSubmit={handleVerify}>
            <label style={styles.lbl}>Verification code</label>
            <input
              style={styles.input}
              type="text"
              placeholder="123456"
              value={code}
              onChange={(e) => { setCode(e.target.value); if (err) setErr(''); }}
              required
            />
            {err && <div style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="submit" style={{ ...styles.btn, ...styles.btnPrimary, flex: 1 }} disabled={busy}>
                {busy ? 'Verifying…' : 'Verify'}
              </button>
              <button type="button" style={{ ...styles.btn, flex: 1 }} onClick={handleResend} disabled={busy}>
                Resend code
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" style={{ ...styles.btn, flex: 1 }} onClick={onClose} disabled={busy}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/* ---------------- Forgot Password (unchanged logic) ---------------- */
function ForgotPasswordModal({ onClose }) {
  const { forgot, verifyReset, resetPassword } = useAuth();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const submitEmail = async (e) => {
    e.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try { await forgot(email); setInfo('Check your email for a 6-digit code.'); setStep(2); }
    catch (ex) { setErr(ex?.message || 'Could not send reset email'); }
    finally { setBusy(false); }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try { const ok = await verifyReset(email, code); if (!ok) throw new Error('Invalid or expired code'); setStep(3); }
    catch (ex) { setErr(ex?.message || 'Invalid or expired code'); }
    finally { setBusy(false); }
  };

  const submitNewPw = async (e) => {
    e.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try { await resetPassword(email, code, pw); onClose(); }
    catch (ex) { setErr(ex?.message || 'Could not reset password'); }
    finally { setBusy(false); }
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {step === 1 && (
          <>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Forgot password</h3>
            <form onSubmit={submitEmail}>
              <label style={styles.lbl}>Enter your email</label>
              <input style={styles.input} type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              {err && <div style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{err}</div>}
              {info && <div style={{ color: '#34d399', fontSize: 12, marginTop: 8 }}>{info}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="submit" style={{ ...styles.btn, ...styles.btnPrimary, flex: 1 }} disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
                <button type="button" style={{ ...styles.btn, flex: 1 }} onClick={onClose} disabled={busy}>Cancel</button>
              </div>
            </form>
          </>
        )}
        {step === 2 && (
          <>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Verify code</h3>
            <form onSubmit={submitCode}>
              <label style={styles.lbl}>Code (check your email)</label>
              <input style={styles.input} type="text" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required />
              {err && <div style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{err}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="submit" style={{ ...styles.btn, ...styles.btnPrimary, flex: 1 }} disabled={busy}>{busy ? 'Checking…' : 'Verify'}</button>
                <button type="button" style={{ ...styles.btn, flex: 1 }} onClick={() => setStep(1)} disabled={busy}>Back</button>
              </div>
            </form>
          </>
        )}
        {step === 3 && (
          <>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Set a new password</h3>
            <form onSubmit={submitNewPw}>
              <label style={styles.lbl}>New password</label>
              <input style={styles.input} type="password" placeholder="••••••••" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} />
              {err && <div style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{err}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="submit" style={{ ...styles.btn, ...styles.btnPrimary, flex: 1 }} disabled={busy}>{busy ? 'Saving…' : 'Save & log in'}</button>
                <button type="button" style={{ ...styles.btn, flex: 1 }} onClick={() => setStep(2)} disabled={busy}>Back</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Auth modal ---------------- */
function AuthModal({ mode = 'login', onClose, onForgotOpen, onNeedVerify }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showLoggingIn, setShowLoggingIn] = useState(false);
  const [who, setWho] = useState({ name: '', email: '' });

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      if (mode === 'login') {
        const u = await login(email, pw);
        setWho({ name: [u?.firstName, u?.lastName].filter(Boolean).join(' '), email: u?.email || email });
        setShowLoggingIn(true);
      } else {
        // Start verification flow (do not create user yet)
        onClose();
        onNeedVerify?.({ email, password: pw, firstName, lastName });
      }
    } catch (ex) {
      const msg = String(ex?.message || '');
      setErr(msg || (mode === 'login' ? 'Invalid password' : 'Could not create account'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <style>{kf}</style>
      <div style={styles.backdrop} onClick={onClose}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>{mode === 'login' ? 'Log in' : 'Sign up'}</h3>
          <form onSubmit={onSubmit}>
            {mode === 'signup' && (
              <>
                <label style={styles.lbl}>First name</label>
                <input style={styles.input} type="text" placeholder="Jane" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                <label style={styles.lbl}>Last name</label>
                <input style={styles.input} type="text" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </>
            )}
            <label style={styles.lbl}>Email</label>
            <input style={styles.input} type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label style={styles.lbl}>Password</label>
            <input style={styles.input} type="password" placeholder="••••••••" value={pw} onChange={(e) => setPw(e.target.value)} required />
            {mode === 'login' && (
              <div style={{ marginTop: 8 }}>
                <button type="button" onClick={onForgotOpen} style={{ ...styles.btn, padding: 6 }} disabled={busy}>
                  Forgot password?
                </button>
              </div>
            )}
            {err && <div style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="submit" disabled={busy} style={{ ...styles.btn, ...styles.btnPrimary, flex: 1 }}>
                {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
              </button>
              <button type="button" style={{ ...styles.btn, flex: 1 }} onClick={onClose} disabled={busy}>Cancel</button>
            </div>
            <p style={styles.muted}>
              {mode === 'login'
                ? 'Welcome back!'
                : 'Passwords are hashed on the server. We’ll verify your email before creating the account.'}
            </p>
          </form>
        </div>
      </div>

      {showLoggingIn && (
        <LoggingInModal
          name={who.name}
          email={who.email}
          onDone={() => { onClose(); navigate('/groups'); }}
        />
      )}
    </>
  );
}

/* ---------------- Header ---------------- */
export default function Header() {
  const { user, logout, settings } = useAuth();
  const navigate = useNavigate();

  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const [pendingSignup, setPendingSignup] = useState(null); // {email,password,firstName,lastName}

  // goodbye modal
  const [showGoodbye, setShowGoodbye] = useState(false);
  const [goodbyeName, setGoodbyeName] = useState('');

  const modeLabel = settings?.mockMode ? 'Mock Mode' : (settings?.ideonKey ? 'Ideon: ON' : 'Ideon: —');

  const onLogout = () => {
    // capture display name before clearing auth
    const display =
      user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.firstName
        ? user.firstName
        : user?.email || '';
    setGoodbyeName(display);
    setShowGoodbye(true);

    // clear auth immediately
    logout();

    // after the mini animation, go home
    setTimeout(() => {
      setShowGoodbye(false);
      navigate('/');
    }, 1400);
  };

  return (
    <>
      <header style={styles.header}>
        <Link to="/" style={styles.brand}>
          ICHRA Quoting Tool <span style={styles.dot}>•</span> Demo
        </Link>

        <span
          style={{
            marginLeft: 12, padding: '6px 10px', borderRadius: 999,
            border: '1px solid #374151', background: '#111827',
            color: '#e5e7eb', fontSize: 12,
          }}
          title={settings?.mockMode ? 'Using local mock data' : (settings?.ideonKey ? 'Using your Ideon key' : 'No key saved')}
        >
          {modeLabel}
        </span>

        <div style={styles.right}>
          <button style={styles.btn} onClick={() => setShowSettings(true)} title="Settings" aria-label="Open settings">⚙️</button>

          {!user ? (
            <>
              <button style={styles.btn} onClick={() => setShowLogin(true)}>Log in</button>
              <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setShowSignup(true)}>Sign up</button>
            </>
          ) : (
            <div style={styles.userWrap}>
              <span style={styles.userName}>
                {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
              </span>
              <button style={styles.btn} onClick={onLogout}>Log out</button>
            </div>
          )}
        </div>
      </header>

      {showLogin && (
        <AuthModal
          mode="login"
          onClose={() => setShowLogin(false)}
          onForgotOpen={() => { setShowLogin(false); setShowForgot(true); }}
        />
      )}
      {showSignup && (
        <AuthModal
          mode="signup"
          onClose={() => setShowSignup(false)}
          onNeedVerify={(p) => setPendingSignup(p)}
        />
      )}
      {showSettings && <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />}
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
      {pendingSignup && (
        <VerifySignupModal
          pending={pendingSignup}
          onClose={() => setPendingSignup(null)}
        />
      )}
      {showGoodbye && (
        <GoodbyeModal name={goodbyeName} onDone={() => { setShowGoodbye(false); navigate('/'); }} />
      )}
    </>
  );
}