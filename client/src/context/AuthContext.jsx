// client/src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  // Persisted user + token
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("demo:user")) || null; } catch { return null; }
  });
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem("demo:token") || ""; } catch { return ""; }
  });

  // ideon key + mock mode toggle
  const [settings, setSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("demo:settings")) || {
        mockMode: true,
        ideonKey: "",
      };
    } catch {
      return { mockMode: true, ideonKey: "" };
    }
  });

  // keep in localStorage
  useEffect(() => {
    localStorage.setItem("demo:user", JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    if (token) localStorage.setItem("demo:token", token);
    else localStorage.removeItem("demo:token");
  }, [token]);

  useEffect(() => {
    localStorage.setItem("demo:settings", JSON.stringify(settings));
  }, [settings]);

  // --- Auth API calls ---

  /**
   * (Legacy/optional) DB-first signup.
   * With pre-signup verify, you typically won't use this.
   */
  const signup = async (email, password, firstName, lastName) => {
    const res = await api.signup?.(email, password, firstName, lastName);
    if (res?.token && res?.user) {
      setUser(res.user);
      setToken(res.token);
      return res.user;
    }
    const u = { id: crypto.randomUUID(), email, firstName, lastName };
    setUser(u);
    return u;
  };

  const login = async (email, password) => {
    try {
      const res = await api.login(email, password);
      if (res?.token && res?.user) {
        setUser(res.user);
        setToken(res.token);
        return res.user;
      }
      throw new Error("Invalid password");
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.toLowerCase().includes("credential")) throw new Error("Invalid password");
      throw e;
    }
  };

  const logout = () => {
    setUser(null);
    setToken("");
  };

  // ---- Password reset (code-based) ----
  const forgot = async (email) => {
    await api.forgot(email); // POST /auth/request-code
    return true;
  };

  const verifyReset = async (email, code) => {
    const res = await api.verifyReset(email, code); // POST /auth/verify-code
    return !!(res?.ok || res?.valid || res?.success || res?.verified);
  };

  const resetPassword = async (email, code, newPassword) => {
    const res = await api.resetPassword(email, code, newPassword); // POST /auth/reset-with-code
    if (res?.token && res?.user) {
      setUser(res.user);
      setToken(res.token);
      return res.user;
    }
    return true;
  };

  // ---- PRE-SIGNUP verification (no user until verify) ----
  const requestSignupCode = async (email) => {
    await api.requestSignupCode(email); // POST /auth/pre-signup/request-code
    return true;
  };

  /**
   * Verify code AND create the user.
   * payload = { email, code, firstName, lastName, password }
   * Server returns { user, token } on success.
   */
  const verifySignupCode = async (payload) => {
    const res = await api.verifySignupCode(payload); // POST /auth/pre-signup/verify
    if (res?.token && res?.user) {
      setUser(res.user);
      setToken(res.token);
      return true;
    }
    return !!(res?.ok || res?.verified || res?.success);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      settings,
      setSettings,
      // auth
      login,
      signup,
      logout,
      // reset
      forgot,
      verifyReset,
      resetPassword,
      // pre-signup verify
      requestSignupCode,
      verifySignupCode,
      isAuthed: !!user,
    }),
    [user, token, settings]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}