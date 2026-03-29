import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, permissions = [] }) {
  const { isReady, isAuthenticated, profile } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return <div className="auth-loading">Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/dang-nhap-nhan-su" replace state={{ from: location.pathname }} />;
  }

  if (permissions.length > 0) {
    const profilePermissions = profile?.permissions || [];
    const hasPermission = permissions.every((permission) => profilePermissions.includes(permission));

    if (!hasPermission) {
      return <Navigate to="/khong-co-quyen" replace />;
    }
  }

  return children;
}
