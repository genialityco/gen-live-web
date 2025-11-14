import { useEffect } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { useAuth } from '../auth/AuthProvider';
import { auth } from '../core/firebase';

/**
 * Hook que garantiza que siempre haya una sesión anónima activa
 */
export const useAnonymousAuth = () => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || user) return;

    const createAnonymousSession = async () => {
      try {
        console.log("🔐 useAnonymousAuth: Creating automatic anonymous session...");
        await signInAnonymously(auth);
        console.log("✅ useAnonymousAuth: Anonymous session created");
      } catch (error) {
        console.error("❌ useAnonymousAuth: Failed to create anonymous session:", error);
      }
    };

    // Pequeño delay para permitir que Firebase se inicialice
    const timer = setTimeout(createAnonymousSession, 500);
    return () => clearTimeout(timer);
  }, [user, loading]);

  return { user, loading, isAnonymous: !!user?.isAnonymous };
};