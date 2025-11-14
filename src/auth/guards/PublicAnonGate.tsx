import { useEffect } from "react";
import { signInAnonymously } from "firebase/auth";
import { auth } from "../../core/firebase";

export default function PublicAnonGate({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!auth.currentUser) signInAnonymously(auth).catch(() => {});
    else if (!auth.currentUser.isAnonymous) {
      // nada: es admin logueado; puede ver público también
    }
  }, []);
  return <>{children}</>;
}
