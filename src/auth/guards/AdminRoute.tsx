import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../AuthProvider";

export default function AdminRoute() {
  const { user, loading, isAnonymous } = useAuth();
  const loc = useLocation();

  if (loading) return null; // opcional: spinner
  if (!user || isAnonymous) {
    return <Navigate to="/admin-auth" replace state={{ from: loc.pathname }} />;
  }
  return <Outlet />;
}
