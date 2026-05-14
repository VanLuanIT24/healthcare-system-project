const AUTH_STORAGE_KEY = 'healthcare.auth';
const AUTH_SESSION_STORAGE_KEY = 'healthcare.auth.session';
const SITE_LANGUAGE_STORAGE_KEY = 'healthcare.siteLanguage';

function readJson(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function removeAuthRecords() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (error) {
    // Ignore storage access errors and let callers continue safely.
  }

  try {
    sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch (error) {
    // Ignore storage access errors and let callers continue safely.
  }
}

function getStoredAuthScope() {
  try {
    if (sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)) return 'session';
  } catch (error) {
    // Ignore storage access errors and continue to localStorage.
  }

  try {
    if (localStorage.getItem(AUTH_STORAGE_KEY)) return 'local';
  } catch (error) {
    // Ignore storage access errors and fall back to default behavior.
  }

  return null;
}

export function readStoredAuth() {
  const sessionAuth = readJson(sessionStorage, AUTH_SESSION_STORAGE_KEY);
  if (sessionAuth) return sessionAuth;
  return readJson(localStorage, AUTH_STORAGE_KEY);
}

export function writeStoredAuth(data, options = {}) {
  const targetScope = options.persist === true
    ? 'local'
    : options.persist === false
      ? 'session'
      : (getStoredAuthScope() || 'local');

  removeAuthRecords();

  if (targetScope === 'session') {
    sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(data));
    return;
  }

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
}

export function clearStoredAuth() {
  removeAuthRecords();
}
export function readStoredSiteLanguage() {
  try {
    return localStorage.getItem(SITE_LANGUAGE_STORAGE_KEY) || 'vi';
  } catch (error) {
    return 'vi';
  }
}
export function writeStoredSiteLanguage(language) {
  localStorage.setItem(SITE_LANGUAGE_STORAGE_KEY, language);
}
