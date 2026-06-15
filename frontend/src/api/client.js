import axios from "axios";

import { authStorage } from "../features/auth/authStorage.js";

function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
  }

  return "http://localhost:8000/api/v1";
}

const API_BASE_URL = resolveApiBaseUrl();
const RETRYABLE_STATUS_CODES = new Set([408, 429, 502, 503, 504]);
const SAFE_RETRY_METHODS = new Set(["get", "head", "options"]);
const AUTH_RETRY_PATHS = new Set(["/auth/token/", "/auth/token/refresh/"]);
const MAX_TRANSIENT_RETRIES = 3;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const accessToken = authStorage.getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isAuthTokenRequest(config) {
  const url = config?.url || "";
  return AUTH_RETRY_PATHS.has(url);
}

function shouldRetryTransientError(error) {
  const config = error.config;
  if (!config || config._retryCount >= MAX_TRANSIENT_RETRIES) {
    return false;
  }

  const method = (config.method || "get").toLowerCase();
  const isSafeRequest = SAFE_RETRY_METHODS.has(method) || isAuthTokenRequest(config);
  if (!isSafeRequest) {
    return false;
  }

  const status = error.response?.status;
  return !status || RETRYABLE_STATUS_CODES.has(status);
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (shouldRetryTransientError(error)) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      await delay(700 * originalRequest._retryCount);
      return apiClient(originalRequest);
    }

    if (error.response?.status !== 401 || originalRequest?._retry) {
      return Promise.reject(error);
    }

    const refreshToken = authStorage.getRefreshToken();
    if (!refreshToken) {
      authStorage.clear();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
        refresh: refreshToken,
      });
      authStorage.setTokens(response.data);
      originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      authStorage.clear();
      return Promise.reject(refreshError);
    }
  },
);
