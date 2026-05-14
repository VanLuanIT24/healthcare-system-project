import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from './api';

const DEFAULT_DEBOUNCE_MS = 800;

function parseRetryAfterSeconds(response, payload) {
  const headerValue = Number(response.headers.get('Retry-After'));
  if (Number.isFinite(headerValue) && headerValue > 0) return headerValue;

  const retryAfter = Number(payload?.details?.retry_after_seconds);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter;

  return 0;
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

function normalizeText(value) {
  return String(value || '').trim();
}

export function inferIdentifierFields(identifier) {
  const normalized = normalizeText(identifier);
  if (!normalized) return {};

  if (normalized.includes('@')) {
    return { email: normalized.toLowerCase() };
  }

  if (/^\d{9,11}$/.test(normalized)) {
    return { phone: normalized };
  }

  return { username: normalized.toLowerCase() };
}

export function translatePasswordPolicyMessage(message, actorType = 'staff') {
  const text = normalizeText(message);
  if (!text) return '';

  if (/Password is required\./i.test(text)) return 'Vui lòng nhập mật khẩu.';

  const minLengthMatch = text.match(/Password must contain at least (\d+) characters\./i);
  if (minLengthMatch) {
    return `Mật khẩu phải có ít nhất ${minLengthMatch[1]} ký tự.`;
  }

  if (/Password must not exceed 128 characters\./i.test(text)) {
    return 'Mật khẩu không được quá 128 ký tự.';
  }

  if (/Password must contain lowercase letter\./i.test(text)) {
    return 'Mật khẩu phải có chữ thường.';
  }

  if (/Password must contain number\./i.test(text)) {
    return 'Mật khẩu phải có số.';
  }

  if (/Staff password must contain uppercase letter\./i.test(text)) {
    return actorType === 'staff'
      ? 'Mật khẩu nhân sự phải có chữ hoa.'
      : 'Mật khẩu phải có chữ hoa.';
  }

  if (/Staff password must contain special character\./i.test(text)) {
    return actorType === 'staff'
      ? 'Mật khẩu nhân sự phải có ký tự đặc biệt.'
      : 'Mật khẩu phải có ký tự đặc biệt.';
  }

  if (/Password is too common\./i.test(text)) {
    return 'Mật khẩu quá phổ biến.';
  }

  if (/Password must not contain username, email, or phone\./i.test(text)) {
    return 'Mật khẩu không được chứa tên đăng nhập, email hoặc số điện thoại.';
  }

  if (/Password policy validation failed/i.test(text)) {
    return 'Mật khẩu chưa đáp ứng chính sách bảo mật.';
  }

  if (/Quá nhiều yêu cầu kiểm tra mật khẩu/i.test(text)) {
    return 'Bạn đã kiểm tra mật khẩu quá nhiều lần. Vui lòng thử lại sau.';
  }

  return text;
}

function uniqueMessages(messages = []) {
  return Array.from(new Set(messages.map((item) => normalizeText(item)).filter(Boolean)));
}

function extractPasswordPolicyMessages(payload, actorType) {
  const detailMessages = Array.isArray(payload?.details)
    ? payload.details.map((item) => translatePasswordPolicyMessage(item?.message, actorType))
    : [];
  const topMessage = translatePasswordPolicyMessage(payload?.message, actorType);
  const messages = uniqueMessages([
    ...detailMessages,
    ...(detailMessages.length ? [] : [topMessage]),
  ]);

  return messages.length ? messages : ['Không thể kiểm tra mật khẩu lúc này.'];
}

export async function validatePasswordPolicyRequest({
  actorType,
  password,
  username,
  email,
  phone,
  clientApp,
  signal,
}) {
  const normalizedActorType = actorType === 'staff' ? 'staff' : 'patient';
  const response = await fetch(`${API_BASE_URL}/auth/password/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Platform': 'web',
      'X-Client-App': clientApp || (normalizedActorType === 'staff' ? 'staff-portal' : 'patient-portal'),
    },
    body: JSON.stringify({
      actorType: normalizedActorType,
      password,
      ...(normalizeText(username) ? { username: normalizeText(username).toLowerCase() } : {}),
      ...(normalizeText(email) ? { email: normalizeText(email).toLowerCase() } : {}),
      ...(normalizeText(phone) ? { phone: normalizeText(phone) } : {}),
    }),
    signal,
  });

  const payload = await readJsonResponse(response);
  if (!response.ok) {
    const error = new Error(extractPasswordPolicyMessages(payload, normalizedActorType)[0]);
    error.status = response.status;
    error.payload = payload;
    error.messages = extractPasswordPolicyMessages(payload, normalizedActorType);
    error.cooldownSeconds = parseRetryAfterSeconds(response, payload);
    throw error;
  }

  return payload?.data || { valid: true };
}

export function usePasswordPolicyValidation({
  actorType,
  password,
  username,
  email,
  phone,
  clientApp,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}) {
  const [status, setStatus] = useState('idle');
  const [messages, setMessages] = useState([]);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [hasValidated, setHasValidated] = useState(false);
  const requestIdRef = useRef(0);
  const abortRef = useRef(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;

    const timer = window.setTimeout(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  const resetValidation = useCallback(() => {
    requestIdRef.current += 1;
    abortRef.current?.abort?.();
    abortRef.current = null;
    setStatus('idle');
    setMessages([]);
    setCooldownSeconds(0);
    setHasValidated(false);
  }, []);

  const validateNow = useCallback(async () => {
    const normalizedPassword = String(password || '');
    if (!enabled || !normalizedPassword) {
      resetValidation();
      return {
        valid: false,
        skipped: true,
        status: 'idle',
        messages: [],
      };
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    abortRef.current?.abort?.();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('checking');
    setMessages([]);

    try {
      await validatePasswordPolicyRequest({
        actorType,
        password: normalizedPassword,
        username,
        email,
        phone,
        clientApp,
        signal: controller.signal,
      });

      if (requestId !== requestIdRef.current) {
        return {
          valid: false,
          stale: true,
          status: 'idle',
          messages: [],
        };
      }

      setStatus('valid');
      setMessages([]);
      setCooldownSeconds(0);
      setHasValidated(true);
      return {
        valid: true,
        status: 'valid',
        messages: [],
      };
    } catch (error) {
      if (error?.name === 'AbortError') {
        return {
          valid: false,
          aborted: true,
          status: 'idle',
          messages: [],
        };
      }

      if (requestId !== requestIdRef.current) {
        return {
          valid: false,
          stale: true,
          status: 'idle',
          messages: [],
        };
      }

      const nextStatus = error?.status === 429 ? 'rate-limited' : error?.status ? 'invalid' : 'error';
      const nextMessages = uniqueMessages(error?.messages || [error?.message || 'Không thể kiểm tra mật khẩu lúc này.']);
      setStatus(nextStatus);
      setMessages(nextMessages);
      setCooldownSeconds(error?.cooldownSeconds || 0);
      setHasValidated(true);
      return {
        valid: false,
        status: nextStatus,
        messages: nextMessages,
        cooldownSeconds: error?.cooldownSeconds || 0,
      };
    }
  }, [actorType, clientApp, email, enabled, password, phone, resetValidation, username]);

  useEffect(() => {
    if (!enabled || !String(password || '')) {
      resetValidation();
      return undefined;
    }

    const timer = window.setTimeout(() => {
      validateNow().catch(() => {});
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [actorType, debounceMs, email, enabled, password, phone, resetValidation, username, validateNow]);

  return {
    status,
    messages,
    cooldownSeconds,
    hasValidated,
    isChecking: status === 'checking',
    isValid: status === 'valid',
    validateNow,
    resetValidation,
  };
}
