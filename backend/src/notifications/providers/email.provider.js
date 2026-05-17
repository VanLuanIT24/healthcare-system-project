const { PatientAccount, PatientRelative, User } = require('../../models');
const emailService = require('../../services/email.service');

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

async function resolveRecipientEmail(notification = {}) {
  if (notification.payload?.email_to) return notification.payload.email_to;
  if (notification.payload?.to_email) return notification.payload.to_email;

  if (notification.recipient_user_id || notification.recipient_type === 'staff') {
    const user = await User.findById(notification.recipient_user_id || notification.recipient_id).select('email').lean();
    return user?.email;
  }

  if (notification.patient_account_id || notification.recipient_type === 'patient') {
    const account = await PatientAccount.findById(notification.patient_account_id || notification.recipient_id).select('email').lean();
    return account?.email;
  }

  if (notification.relative_id || notification.recipient_type === 'relative') {
    const relative = await PatientRelative.findById(notification.relative_id || notification.recipient_id).select('email').lean();
    return relative?.email;
  }

  return null;
}

async function send(notification = {}, delivery = {}) {
  const to = await resolveRecipientEmail(notification);
  const result = await emailService.sendMail({
    to,
    subject: notification.title,
    text: notification.body || notification.message,
    html: notification.payload?.html,
    replyTo: notification.payload?.reply_to,
  });
  if (result?.skipped) {
    throw new Error(result.reason || 'email_skipped');
  }
  return {
    provider: delivery.provider || 'smtp',
    provider_message_id: toId(result?.messageId) || result?.messageId,
    delivered: false,
    sent: true,
  };
}

module.exports = {
  isEnabled: emailService.isEmailEnabled,
  send,
};
