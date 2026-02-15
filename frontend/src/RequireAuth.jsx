import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;

  if (!user) {
    // /loginや/adminからのリダイレクトの場合はfromを保存しない
    const shouldSaveFrom = location.pathname !== "/login" && location.pathname !== "/admin";
    return <Navigate to="/login" replace state={shouldSaveFrom ? { from: location } : null} />;
  }

  return children;
}
