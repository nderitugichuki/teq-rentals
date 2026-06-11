import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./AuthContext.jsx";

export function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-soft">
          Loading your workspace...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

