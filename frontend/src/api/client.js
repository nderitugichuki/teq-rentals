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

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

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
