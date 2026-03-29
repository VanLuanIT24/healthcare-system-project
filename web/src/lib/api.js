const API_BASE_URL = 'http://localhost:3000/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({
    success: false,
    message: 'Không thể đọc phản hồi từ máy chủ.',
  }));

  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || 'Yêu cầu không thành công.');
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

export const api = {
  request,
};
