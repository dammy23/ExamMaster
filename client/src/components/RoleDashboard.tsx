import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function RoleDashboard() {
  const { user } = useAuth();

  // This should only be reached if user is authenticated (protected by ProtectedRoute)
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect based on user role
  if (user.role === 'admin') {
    return <Navigate to="/admin" replace />;
  } else if (user.role === 'student') {
    return <Navigate to="/student" replace />;
  }

  // Fallback: if role is unknown, redirect to login
  return <Navigate to="/login" replace />;
}