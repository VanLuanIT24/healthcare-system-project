const AUTH_STORAGE_KEY = 'healthcare.auth';
const SITE_LANGUAGE_STORAGE_KEY = 'healthcare.siteLanguage';
export function readStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}
export function writeStoredAuth(data) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
}
export function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
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
