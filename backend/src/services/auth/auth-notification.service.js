const notificationService = require('../notification.service');
const emailService = require('../email.service');
const { ACTOR_TYPE } = require('./auth.policy');

const BRAND_NAME = 'MedCare Portal';
const BRAND_TAGLINE = 'Cong thong tin va van hanh cham soc suc khoe';

function internalActor() {
  return {
    internal: true,
    createdByModule: 'auth',
  };
}

function buildRecipient(account, actorType) {
  if (!account) return null;

  if (actorType === ACTOR_TYPE.STAFF) {
    return {
      recipient_user_id: account._id,
    };
  }

  if (actorType === ACTOR_TYPE.PATIENT) {
    return {
      patient_account_id: account._id,
      patient_id: account.patient_id,
    };
  }

  return null;
}

function actorLabel(actorType) {
  return actorType === ACTOR_TYPE.STAFF ? 'nhân sự' : 'bệnh nhân';
}

function accountDisplayName(account, actorType) {
  return account?.full_name || account?.fullName || account?.username || account?.email || `tài khoản ${actorLabel(actorType)}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Trong thoi gian ngan';
  return date.toLocaleString('vi-VN');
}

function buildMailShell({
  eyebrow,
  title,
  intro,
  accent = '#1f6ef1',
  sections = [],
  footer = '',
} = {}) {
  return `
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="margin:0;padding:24px 12px;background:#edf4ff;font-family:Arial,'Segoe UI',sans-serif;color:#17376a;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d7e2f1;border-radius:24px;overflow:hidden;box-shadow:0 20px 48px rgba(31,110,241,0.12);">
          <div style="padding:28px 32px;background:linear-gradient(135deg,#f7fbff 0%,#eef6ff 55%,#f2fffb 100%);border-bottom:1px solid #dde7f4;">
            <div style="display:inline-flex;align-items:center;gap:14px;">
              <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#22c1f1 0%,#1f6ef1 55%,#12c3a3 100%);display:grid;place-items:center;color:#ffffff;font-size:28px;font-weight:700;line-height:1;">+</div>
              <div>
                <div style="font-size:28px;line-height:1.05;font-weight:800;color:#133a74;">${BRAND_NAME}</div>
                <div style="margin-top:6px;font-size:13px;line-height:1.4;color:#6b7e99;">${BRAND_TAGLINE}</div>
              </div>
            </div>
          </div>

          <div style="padding:34px 32px 18px;">
            <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:${accent}12;color:${accent};font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;">
              ${escapeHtml(eyebrow)}
            </div>
            <h1 style="margin:18px 0 12px;font-size:34px;line-height:1.15;color:#15356a;">${escapeHtml(title)}</h1>
            <p style="margin:0;font-size:16px;line-height:1.75;color:#5f738f;">${intro}</p>
          </div>

          <div style="padding:0 32px 32px;">
            ${sections.join('')}
          </div>

          <div style="padding:18px 32px 28px;border-top:1px solid #e4ebf4;background:#fbfdff;">
            <p style="margin:0;font-size:13px;line-height:1.75;color:#7a8ca6;">${footer}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildInfoPanel(title, body, tone = 'blue') {
  const palette = {
    blue: {
      border: '#cfe0ff',
      background: '#f4f8ff',
      color: '#1f5fc4',
    },
    green: {
      border: '#cdeede',
      background: '#f3fcf7',
      color: '#138d5a',
    },
    amber: {
      border: '#f7dfbd',
      background: '#fff8ee',
      color: '#c96a0a',
    },
  }[tone] || {
    border: '#cfe0ff',
    background: '#f4f8ff',
    color: '#1f5fc4',
  };

  return `
    <div style="margin-top:20px;padding:18px 18px;border:1px solid ${palette.border};border-radius:18px;background:${palette.background};">
      <div style="font-size:14px;font-weight:800;color:${palette.color};margin-bottom:8px;">${escapeHtml(title)}</div>
      <div style="font-size:14px;line-height:1.7;color:#4f6280;">${body}</div>
    </div>
  `;
}

function buildCodePanel(code) {
  if (!code) return '';

  return `
    <div style="margin-top:20px;padding:22px 20px;border:1px solid #dbe7f5;border-radius:20px;background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%);text-align:center;">
      <div style="font-size:13px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#6d81a0;">Ma xac minh</div>
      <div style="margin-top:10px;font-size:34px;line-height:1.1;font-weight:900;letter-spacing:10px;color:#15356a;">${escapeHtml(code)}</div>
      <div style="margin-top:10px;font-size:13px;line-height:1.6;color:#7a8ca6;">Ban co the dung ma nay tren man hinh dat lai mat khau neu khong mo lien ket truc tiep.</div>
    </div>
  `;
}

function buildActionButton(label, href, accent = '#1f6ef1') {
  if (!href) return '';

  return `
    <div style="margin-top:22px;">
      <a
        href="${escapeHtml(href)}"
        style="display:inline-block;padding:14px 22px;border-radius:12px;background:${accent};color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;"
      >
        ${escapeHtml(label)}
      </a>
    </div>
  `;
}

function buildMetaList(items = []) {
  const rows = items
    .filter((item) => item?.label && item?.value)
    .map((item) => `
      <tr>
        <td style="padding:7px 0 7px 0;color:#6e819c;font-size:13px;vertical-align:top;">${escapeHtml(item.label)}</td>
        <td style="padding:7px 0 7px 18px;color:#17376a;font-size:13px;font-weight:700;vertical-align:top;">${escapeHtml(item.value)}</td>
      </tr>
    `)
    .join('');

  if (!rows) return '';

  return `
    <div style="margin-top:20px;padding:18px 20px;border:1px solid #dde7f2;border-radius:18px;background:#fbfdff;">
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        ${rows}
      </table>
    </div>
  `;
}

function buildPasswordResetRequestedEmail(account, actorType, context = {}, requestMeta = {}) {
  const resetLink = context.resetLink || '';
  const resetCode = context.resetCode || '';
  const expiresText = formatDateTime(context.expiresAt);
  const accent = actorType === ACTOR_TYPE.STAFF ? '#1f6ef1' : '#12b59a';
  const displayName = accountDisplayName(account, actorType);
  const loginHint = account?.email || account?.username || account?.phone || '';

  return {
    to: account?.email,
    subject: 'MedCare Portal - Yeu cau dat lai mat khau',
    text: [
      `Xin chao ${displayName},`,
      '',
      `He thong da ghi nhan yeu cau dat lai mat khau cho tai khoan ${actorLabel(actorType)} cua ban.`,
      resetLink ? `Lien ket dat lai mat khau: ${resetLink}` : '',
      resetCode ? `Ma xac minh: ${resetCode}` : '',
      `Hieu luc den: ${expiresText}`,
      loginHint ? `Tai khoan: ${loginHint}` : '',
      requestMeta.ipAddress || requestMeta.ip ? `IP yeu cau: ${requestMeta.ipAddress || requestMeta.ip}` : '',
      '',
      'Neu ban khong yeu cau thao tac nay, vui long bo qua email hoac doi mat khau ngay khi dang nhap lai.',
    ].filter(Boolean).join('\n'),
    html: buildMailShell({
      eyebrow: 'Khoi phuc mat khau',
      title: 'Yeu cau dat lai mat khau',
      intro: `Xin chao <strong>${escapeHtml(displayName)}</strong>, he thong da ghi nhan yeu cau dat lai mat khau cho tai khoan ${escapeHtml(actorLabel(actorType))} cua ban.`,
      accent,
      sections: [
        buildInfoPanel(
          'Huong dan nhanh',
          'Su dung nut ben duoi de mo trang dat lai mat khau. Neu ban dang thao tac tren dien thoai khac hoac khong mo duoc lien ket, hay dung ma xac minh ben duoi.',
          'blue',
        ),
        buildActionButton('Mo trang dat lai mat khau', resetLink, accent),
        resetLink
          ? `<div style="margin-top:16px;font-size:13px;line-height:1.7;color:#6f829c;">Neu nut khong mo duoc, hay sao chep lien ket sau vao trinh duyet:<br /><a href="${escapeHtml(resetLink)}" style="color:${accent};word-break:break-all;">${escapeHtml(resetLink)}</a></div>`
          : '',
        buildCodePanel(resetCode),
        buildMetaList([
          { label: 'Loai tai khoan', value: actorLabel(actorType) },
          { label: 'Hieu luc den', value: expiresText },
          { label: 'Tai khoan', value: loginHint },
          { label: 'IP yeu cau', value: requestMeta.ipAddress || requestMeta.ip },
        ]),
        buildInfoPanel(
          'Luu y bao mat',
          'Lien ket va ma xac minh chi duoc dung mot lan. Neu ban khong yeu cau dat lai mat khau, vui long bo qua email nay va kiem tra lai bao mat tai khoan.',
          'amber',
        ),
      ],
      footer: 'Email nay duoc gui tu he thong MedCare Portal. Vui long khong chia se ma xac minh hoac lien ket dat lai mat khau cho nguoi khac.',
    }),
  };
}

function buildPasswordResetCompletedEmail(account, actorType) {
  const accent = actorType === ACTOR_TYPE.STAFF ? '#1f6ef1' : '#12b59a';
  const displayName = accountDisplayName(account, actorType);
  const loginHint = account?.email || account?.username || account?.phone || '';

  return {
    to: account?.email,
    subject: 'MedCare Portal - Mat khau da duoc dat lai',
    text: [
      `Xin chao ${displayName},`,
      '',
      `Mat khau cho tai khoan ${actorLabel(actorType)} cua ban da duoc cap nhat thanh cong.`,
      'Tat ca phien dang nhap cu da bi dang xuat vi ly do bao mat.',
      loginHint ? `Tai khoan: ${loginHint}` : '',
      '',
      'Neu ban khong thuc hien thao tac nay, vui long lien he quan tri he thong ngay lap tuc.',
    ].filter(Boolean).join('\n'),
    html: buildMailShell({
      eyebrow: 'Bao mat tai khoan',
      title: 'Mat khau da duoc dat lai',
      intro: `Xin chao <strong>${escapeHtml(displayName)}</strong>, mat khau cho tai khoan ${escapeHtml(actorLabel(actorType))} cua ban da duoc cap nhat thanh cong.`,
      accent,
      sections: [
        buildInfoPanel(
          'Cap nhat da hoan tat',
          'Tat ca phien dang nhap cu da bi dang xuat. Vui long dang nhap lai bang mat khau moi tren thiet bi ma ban tin cay.',
          'green',
        ),
        buildMetaList([
          { label: 'Loai tai khoan', value: actorLabel(actorType) },
          { label: 'Tai khoan', value: loginHint },
        ]),
        buildInfoPanel(
          'Khong phai ban?',
          'Neu ban khong thuc hien thao tac dat lai mat khau nay, hay lien he quan tri he thong ngay lap tuc va khoa cac kenh truy cap lien quan.',
          'amber',
        ),
      ],
      footer: 'Thong bao nay duoc gui de xac nhan thay doi bao mat tren tai khoan cua ban.',
    }),
  };
}

async function safeEmail(messageFactory) {
  try {
    const message = messageFactory();
    if (!message?.to) return null;
    return await emailService.sendMail(message);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth-email] Gui email that bai:', error?.message || error);
    }
    return null;
  }
}

async function safeNotify(account, actorType, payload = {}, requestMeta = {}) {
  try {
    const recipient = buildRecipient(account, actorType);
    if (!recipient) return null;

    return await notificationService.createNotification({
      ...recipient,
      notification_type: payload.notification_type || 'auth.event',
      priority: payload.priority || 'normal',
      title: payload.title,
      message: payload.message,
      dedupe_key: payload.dedupe_key,
      payload: {
        actor_type: actorType,
        account_id: String(account._id),
        ...payload.payload,
      },
      created_by_module: 'auth',
    }, internalActor(), requestMeta);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth-notify] Tao notification that bai:', error?.message || error);
    }
    return null;
  }
}

function notifyNewLogin(account, actorType, requestMeta = {}) {
  return safeNotify(account, actorType, {
    notification_type: 'auth.new_login',
    title: 'Đăng nhập mới',
    message: 'Tài khoản của bạn vừa đăng nhập trên một thiết bị hoặc phiên mới.',
    dedupe_key: `auth.new_login:${actorType}:${account?._id}:${Date.now()}`,
    payload: {
      ip_address: requestMeta.ipAddress || requestMeta.ip,
      user_agent: requestMeta.userAgent || requestMeta.user_agent,
    },
  }, requestMeta);
}

function notifyPasswordChanged(account, actorType, requestMeta = {}) {
  return safeNotify(account, actorType, {
    notification_type: 'auth.password_changed',
    title: 'Mật khẩu đã được thay đổi',
    message: 'Mật khẩu tài khoản của bạn vừa được thay đổi.',
    dedupe_key: `auth.password_changed:${actorType}:${account?._id}:${Date.now()}`,
  }, requestMeta);
}

async function notifyPasswordReset(account, actorType, requestMeta = {}) {
  const notificationResult = await safeNotify(account, actorType, {
    notification_type: 'auth.password_reset',
    title: 'Mật khẩu đã được đặt lại',
    message: 'Mật khẩu tài khoản của bạn vừa được đặt lại.',
    dedupe_key: `auth.password_reset:${actorType}:${account?._id}:${Date.now()}`,
  }, requestMeta);

  await safeEmail(() => buildPasswordResetCompletedEmail(account, actorType));

  return notificationResult;
}

async function notifyPasswordResetRequested(account, actorType, context = {}, requestMeta = {}) {
  const notificationResult = await safeNotify(account, actorType, {
    notification_type: 'auth.password_reset_requested',
    priority: 'high',
    title: 'Yêu cầu đặt lại mật khẩu',
    message: 'Hệ thống đã ghi nhận yêu cầu đặt lại mật khẩu cho tài khoản của bạn.',
    dedupe_key: `auth.password_reset_requested:${actorType}:${account?._id}:${Date.now()}`,
    payload: {
      expires_at: context.expiresAt,
      delivery_channel: account?.email ? 'email' : 'internal_notification',
      ip_address: requestMeta.ipAddress || requestMeta.ip,
      user_agent: requestMeta.userAgent || requestMeta.user_agent,
    },
  }, requestMeta);

  await safeEmail(() => buildPasswordResetRequestedEmail(account, actorType, context, requestMeta));

  return notificationResult;
}

function notifySuspiciousLogin(account, actorType, requestMeta = {}) {
  return safeNotify(account, actorType, {
    notification_type: 'auth.suspicious_login',
    priority: 'high',
    title: 'Cảnh báo đăng nhập bất thường',
    message: 'Hệ thống phát hiện hoạt động đăng nhập hoặc token bất thường.',
    dedupe_key: `auth.suspicious:${actorType}:${account?._id}:${Date.now()}`,
    payload: {
      ip_address: requestMeta.ipAddress || requestMeta.ip,
      user_agent: requestMeta.userAgent || requestMeta.user_agent,
    },
  }, requestMeta);
}

function notifyAccountLocked(account, actorType, requestMeta = {}) {
  return safeNotify(account, actorType, {
    notification_type: 'auth.account_locked',
    priority: 'high',
    title: 'Tài khoản bị khóa',
    message: 'Tài khoản của bạn đã tạm bị khóa do nhiều lần đăng nhập thất bại.',
    dedupe_key: `auth.account_locked:${actorType}:${account?._id}:${Date.now()}`,
  }, requestMeta);
}

module.exports = {
  // notifyAccountLocked: Gửi thông báo về tài khoản bị khóa.
  notifyAccountLocked,
  // notifyNewLogin: Gửi thông báo về lần đăng nhập mới.
  notifyNewLogin,
  // notifyPasswordChanged: Gửi thông báo về sự kiện đổi mật khẩu.
  notifyPasswordChanged,
  // notifyPasswordResetRequested: Gửi thông báo về yêu cầu đặt lại mật khẩu.
  notifyPasswordResetRequested,
  // notifyPasswordReset: Gửi thông báo về đặt lại mật khẩu.
  notifyPasswordReset,
  // notifySuspiciousLogin: Gửi thông báo về đăng nhập đáng ngờ.
  notifySuspiciousLogin,
};
