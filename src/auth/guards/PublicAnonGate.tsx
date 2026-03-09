import { useEffect } from "react";
import { signInAnonymously } from "firebase/auth";
import { auth } from "../../core/firebase";
import { useAuth } from "../AuthProvider";

export default function PublicAnonGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();

  useEffect(() => {
    // Esperar a que Firebase termine de restaurar la sesión antes de crear anónimo.
    // Si se llama signInAnonymously mientras loading=true, se reemplaza al admin
    // autenticado con una sesión anónima en todas las pestañas.
    if (loading) return;
    if (!user) signInAnonymously(auth).catch(() => {});
    // Si user existe (anónimo o admin), no hacer nada
  }, [loading, user]);

  return <>{children}</>;
}
