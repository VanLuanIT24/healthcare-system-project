import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LogoutPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    async function runLogout() {
      await logout();
      navigate('/dang-nhap-nhan-su', { replace: true });
    }

    runLogout();
  }, [logout, navigate]);

  return <div className="auth-loading">Đang đăng xuất...</div>;
}
