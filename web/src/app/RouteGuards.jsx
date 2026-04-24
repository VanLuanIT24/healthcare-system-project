import { Navigate } from 'react-router-dom';
import {
  getDefaultRouteForAuth,
  isPatientSession,
  isStaffSession,
  isSuperAdminSession,
} from '../lib/authSession';
import { readStoredAuth } from '../lib/storage';

export function StaffRoute({ children }) {
  const auth = readStoredAuth();

  if (!isStaffSession(auth)) {
    return <Navigate to="/staff/login" replace />;
  }

  return children;
}

export function PatientRoute({ children }) {
  const auth = readStoredAuth();

  if (!isPatientSession(auth)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function SuperAdminRoute({ children }) {
  const auth = readStoredAuth();

  if (!isStaffSession(auth)) {
    return <Navigate to="/staff/login" replace />;
  }

  if (!isSuperAdminSession(auth)) {
    return <Navigate to={getDefaultRouteForAuth(auth)} replace />;
  }

  return children;
}
