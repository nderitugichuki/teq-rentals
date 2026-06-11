const ACCESS_TOKEN_KEY = "rms_access_token";
const REFRESH_TOKEN_KEY = "rms_refresh_token";

export const authStorage = {
  getAccessToken() {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken() {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setTokens(tokens) {
    if (tokens.access) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
    }
    if (tokens.refresh) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
    }
  },
  clear() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

