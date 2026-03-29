import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ roles }) {
  const { isAuthenticated, hasAnyRole } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/dang-nhap-nhan-su" replace />;
  }

  if (roles?.length && !hasAnyRole(roles)) {
    return <Navigate to="/khong-co-quyen" replace />;
  }

  return <Outlet />;
}
