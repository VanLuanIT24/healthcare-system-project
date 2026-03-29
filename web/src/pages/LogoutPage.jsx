import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHero } from '../components/PageHero';
import { useAuth } from '../context/AuthContext';

export function LogoutPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  useEffect(() => {
    auth.logout().finally(() => {
      navigate('/dang-nhap-nhan-su');
    });
  }, [auth, navigate]);

  return (
    <PageHero eyebrow="Đăng xuất" title="Phiên đăng nhập đang được kết thúc." description="Bạn sẽ được chuyển về trang đăng nhập nhân sự ngay sau khi hệ thống thu hồi phiên hiện tại." />
  );
}
