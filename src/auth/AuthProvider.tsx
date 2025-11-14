/* eslint-disable react-refresh/only-export-components */
import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { auth } from "../core/firebase";

type Ctx = {
  user: User | null;
  loading: boolean;
  isAnonymous: boolean;
  createAnonymousSession: (email: string) => Promise<string>; // Retorna UID
  getDeviceInfo: () => string; // Info del dispositivo para debugging
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Información del dispositivo para debugging
  const getDeviceInfo = useCallback((): string => {
    const navigator = window.navigator;
    return `${navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other'}_${Date.now()}`;
  }, []);

  // Crear sesión anónima y asociar con email
  const createAnonymousSession = useCallback(async (email: string): Promise<string> => {
    try {
      // Si ya hay un usuario anónimo, usar ese UID
      if (user?.isAnonymous) {
        console.log("📱 Using existing anonymous user:", user.uid, "for email:", email);
        return user.uid;
      }

      // Si no hay usuario o no es anónimo, crear uno nuevo
      console.log("🔐 Creating anonymous user session for email:", email);
      const result = await signInAnonymously(auth);
      
      console.log("✅ Anonymous user created:", result.user.uid, "on device:", getDeviceInfo());
      return result.user.uid;
    } catch (error) {
      console.error("❌ Error creating anonymous session:", error);
      throw error;
    }
  }, [user, getDeviceInfo]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAnonymous: !!user?.isAnonymous,
      createAnonymousSession,
      getDeviceInfo,
    }),
    [user, loading, createAnonymousSession, getDeviceInfo]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
