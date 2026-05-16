import { Navigate, useLocation } from 'react-router-dom';
import {
  createLoginRedirectPath,
  getDefaultRouteForAuth,
  isPatientSession,
  isStaffSession,
  isSuperAdminSession,
} from '../lib/authSession';
import { readStoredAuth } from '../lib/storage';
import { hasRequiredStaffAccess } from '../receptionist/workspaceAccess';

export function StaffRoute({
  children,
  allowedRoles = [],
  requiredPermissions = [],
  anyPermissions = [],
  requiredWorkspaceKey = null,
}) {
  const location = useLocation();
  const auth = readStoredAuth();

  if (!isStaffSession(auth)) {
    return <Navigate to={createLoginRedirectPath(location, 'staff')} replace />;
  }

  if (auth?.user?.must_change_password && !location.pathname.startsWith('/staff/change-password')) {
    return <Navigate to={getDefaultRouteForAuth(auth)} replace />;
  }

  if (!hasRequiredStaffAccess(auth, {
    requiredWorkspaceKey,
    allowedRoles,
    requiredPermissions,
    anyPermissions,
  })) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

export function PatientRoute({ children }) {
  const location = useLocation();
  const auth = readStoredAuth();

  if (!isPatientSession(auth)) {
    return <Navigate to={createLoginRedirectPath(location)} replace />;
  }

  return children;
}

export function SuperAdminRoute({ children }) {
  const location = useLocation();
  const auth = readStoredAuth();

  if (!isStaffSession(auth)) {
    return <Navigate to={createLoginRedirectPath(location, 'staff')} replace />;
  }

  if (auth?.user?.must_change_password && !location.pathname.startsWith('/staff/change-password')) {
    return <Navigate to={getDefaultRouteForAuth(auth)} replace />;
  }

  if (!isSuperAdminSession(auth)) {
    return <Navigate to={getDefaultRouteForAuth(auth)} replace />;
  }

  return children;
}
