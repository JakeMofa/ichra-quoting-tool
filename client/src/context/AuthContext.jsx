// client/src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  // demo auth (localStorage only, no backend yet)
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("demo:user")) || null;
    } catch {
      return null;
    }
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
    localStorage.setItem("demo:settings", JSON.stringify(settings));
  }, [settings]);

  const login = (email, _password) => {
    // in demo: accept anything
    const u = { id: crypto.randomUUID(), email };
    setUser(u);
    return u;
  };

  const signup = (email, _password) => {
    const u = { id: crypto.randomUUID(), email };
    setUser(u);
    return u;
  };

  const logout = () => setUser(null);

  const value = useMemo(
    () => ({
      user,
      settings,
      setSettings,
      login,
      signup,
      logout,
      isAuthed: !!user,
    }),
    [user, settings]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}