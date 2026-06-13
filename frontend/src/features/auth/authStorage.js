const ACCESS_TOKEN_KEY = "rms_access_token";
const REFRESH_TOKEN_KEY = "rms_refresh_token";

function storage() {
  return window.sessionStorage;
}

function clearLegacyLocalTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export const authStorage = {
  getAccessToken() {
    clearLegacyLocalTokens();
    return storage().getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken() {
    clearLegacyLocalTokens();
    return storage().getItem(REFRESH_TOKEN_KEY);
  },
  setTokens(tokens) {
    clearLegacyLocalTokens();
    if (tokens.access) {
      storage().setItem(ACCESS_TOKEN_KEY, tokens.access);
    }
    if (tokens.refresh) {
      storage().setItem(REFRESH_TOKEN_KEY, tokens.refresh);
    }
  },
  clear() {
    clearLegacyLocalTokens();
    storage().removeItem(ACCESS_TOKEN_KEY);
    storage().removeItem(REFRESH_TOKEN_KEY);
  },
};
