const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;
let warnedMissingConfig = false;

function isEmailEnabled() {
  return Boolean(env.smtpEnabled && env.smtpHost && env.smtpFromEmail);
}

function buildTransporter() {
  if (!isEmailEnabled()) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn('[email] SMTP chưa được cấu hình đầy đủ. Email thật sẽ không được gửi.');
    }
    return null;
  }

  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    ...(env.smtpUser
      ? {
        auth: {
          user: env.smtpUser,
          pass: env.smtpPass,
        },
      }
      : {}),
  });

  return transporter;
}

function buildFromAddress() {
  return {
    name: env.smtpFromName || 'MedCare Portal',
    address: env.smtpFromEmail,
  };
}

async function sendMail({ to, subject, text, html, replyTo } = {}) {
  if (!to) {
    return {
      skipped: true,
      reason: 'missing_recipient',
    };
  }

  const mailTransporter = buildTransporter();
  if (!mailTransporter) {
    return {
      skipped: true,
      reason: 'smtp_not_configured',
    };
  }

  return mailTransporter.sendMail({
    from: buildFromAddress(),
    to,
    subject,
    text,
    html,
    replyTo: replyTo || env.smtpReplyTo || undefined,
  });
}

module.exports = {
  isEmailEnabled,
  sendMail,
};
