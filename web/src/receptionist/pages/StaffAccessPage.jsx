import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BriefcaseMedical,
  Check,
  CalendarDays,
  ClipboardPlus,
  FlaskConical,
  HeartPulse,
  Info,
  LogOut,
  Pill,
  ReceiptText,
  ScanLine,
  Settings,
  ShieldCheck,
  Stethoscope,
  WalletCards,
  BarChart3,
  UserPlus,
} from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AppLogo } from '../../app/AppLogo';
import { clearStoredAuth, readStoredAuth } from '../../lib/storage';
import {
  clearRememberedStaffWorkspace,
  getAccessibleStaffWorkspaces,
  getCurrentActiveStaffWorkspace,
  getRememberedStaffWorkspace,
  getStaffActorName,
  rememberStaffWorkspace,
  resolveStaffLandingPath,
  setActiveStaffWorkspace,
} from '../workspaceAccess';

const WORKSPACE_ICON_MAP = {
  shield: ShieldCheck,
  settings: Settings,
  calendar: CalendarDays,
  clipboard: ClipboardPlus,
  'user-plus': UserPlus,
  stethoscope: Stethoscope,
  heart: HeartPulse,
  'heart-pulse': HeartPulse,
  pill: Pill,
  flask: FlaskConical,
  scan: ScanLine,
  wallet: WalletCards,
  receipt: ReceiptText,
  chart: BarChart3,
};

function getWorkspaceIcon(icon) {
  return WORKSPACE_ICON_MAP[icon] || BriefcaseMedical;
}

function getWorkspaceCountLabel(count) {
  if (count <= 1) return '1 workspace khả dụng';
  return `${count} workspace khả dụng`;
}

export function StaffAccessPage() {
  const navigate = useNavigate();
  const auth = readStoredAuth();
  const availableWorkspaces = useMemo(() => getAccessibleStaffWorkspaces(auth), [auth]);
  const activeWorkspace = useMemo(() => getCurrentActiveStaffWorkspace(auth), [auth]);
  const rememberedWorkspace = useMemo(() => getRememberedStaffWorkspace(), []);
  const staffRoles = auth?.user?.roles || auth?.roles || [];
  const isSuperAdmin = Array.isArray(staffRoles) && staffRoles.includes('super_admin');
  const rememberedWorkspaceKey = availableWorkspaces.some((workspace) => workspace.key === rememberedWorkspace?.key)
    ? rememberedWorkspace?.key
    : '';
  const [selectedKey, setSelectedKey] = useState(activeWorkspace?.key || rememberedWorkspaceKey || availableWorkspaces[0]?.key || '');
  const [rememberChoice, setRememberChoice] = useState(Boolean(rememberedWorkspaceKey));

  const selectedWorkspace = useMemo(
    () => availableWorkspaces.find((workspace) => workspace.key === selectedKey) || null,
    [availableWorkspaces, selectedKey],
  );

  if (!auth || auth.actorType !== 'staff') {
    return <Navigate to="/staff/login" replace />;
  }

  if (availableWorkspaces.length === 0) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (auth?.user?.must_change_password || !isSuperAdmin) {
    return <Navigate to={resolveStaffLandingPath(auth)} replace />;
  }

  function handleLogout() {
    clearStoredAuth();
    navigate('/staff/login', { replace: true });
  }

  function handleContinue() {
    if (!selectedWorkspace) return;

    setActiveStaffWorkspace(selectedWorkspace);
    if (rememberChoice) rememberStaffWorkspace(selectedWorkspace, true);
    else clearRememberedStaffWorkspace();

    navigate(selectedWorkspace.path, { replace: true });
  }

  return (
    <main className="staff-workspace-page">
      <div className="staff-login-artwork patient-login-artwork" aria-hidden="true">
        <div className="patient-artwork__molecules">
          {Array.from({ length: 10 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
        <div className="patient-artwork__hospital">
          <span className="patient-artwork__tower patient-artwork__tower--left" />
          <span className="patient-artwork__tower patient-artwork__tower--main" />
          <span className="patient-artwork__tower patient-artwork__tower--right" />
          <span className="patient-artwork__cross" />
          <span className="patient-artwork__shield" />
          <span className="patient-artwork__ecg" />
        </div>
      </div>

      <header className="patient-register-brand patient-login-brand staff-login-brand">
        <Link className="patient-register-logo" to="/home" aria-label="Bộ Y tế">
          <AppLogo variant="horizontal" />
        </Link>
      </header>

      <section className="staff-workspace-card" aria-label="Chọn workspace cho nhân sự">
        <div className="staff-workspace-card__icon" aria-hidden="true">
          <BriefcaseMedical size={28} />
        </div>

        <div className="staff-workspace-card__header">
          <h1>Chọn không gian làm việc</h1>
          <p>Tài khoản của bạn có quyền truy cập nhiều khu vực. Hãy chọn dashboard phù hợp để tiếp tục.</p>
        </div>

        <div className="staff-workspace-profile">
          <strong>{getStaffActorName(auth)}</strong>
          <small>{getWorkspaceCountLabel(availableWorkspaces.length)}</small>
        </div>

        <div className="staff-workspace-grid">
          {availableWorkspaces.map((workspace) => {
            const Icon = getWorkspaceIcon(workspace.icon);
            const isSelected = workspace.key === selectedKey;

            return (
              <button
                key={workspace.key}
                type="button"
                className={`staff-workspace-option staff-workspace-option--${workspace.tone || 'blue'} ${isSelected ? 'is-selected' : ''}`}
                onClick={() => setSelectedKey(workspace.key)}
              >
                <span className="staff-workspace-option__badge">{workspace.badge}</span>
                <span className="staff-workspace-option__icon" aria-hidden="true">
                  <Icon size={34} />
                </span>
                <span className="staff-workspace-option__content">
                  <strong>{workspace.title}</strong>
                  <span>{workspace.description}</span>
                </span>
                <span className="staff-workspace-option__footer">
                  <span className="staff-workspace-option__workspace">{workspace.workspaceLabel}</span>
                  <span className="staff-workspace-option__action">
                    {isSelected ? 'Đã chọn' : 'Chọn workspace'}
                    <ArrowRight size={16} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <label className="staff-workspace-remember">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(event) => setRememberChoice(event.target.checked)}
          />
          <span className="staff-workspace-remember__box" aria-hidden="true">
            {rememberChoice ? <Check size={14} /> : null}
          </span>
          <span>Ghi nhớ lựa chọn này trên thiết bị này</span>
          <Info size={16} />
        </label>

        {availableWorkspaces.length > 1 ? (
          <div className="staff-workspace-note">
            <AlertCircle size={18} />
            <p>Bạn có thể quay lại màn hình này bất kỳ lúc nào nếu cần chuyển sang workspace khác.</p>
          </div>
        ) : null}

        <div className="staff-workspace-actions">
          <button
            type="button"
            className="staff-workspace-submit"
            onClick={handleContinue}
            disabled={!selectedWorkspace}
          >
            <span>Tiếp tục</span>
            <ArrowRight size={18} />
          </button>

          <button type="button" className="staff-workspace-logout" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </section>
    </main>
  );
}
