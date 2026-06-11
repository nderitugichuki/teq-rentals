import { apiClient } from "./client.js";

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  return data?.results || [];
}

export async function listResource(path) {
  const response = await apiClient.get(path);
  if (!response.data || Array.isArray(response.data) || !("results" in response.data)) {
    return normalizeList(response.data);
  }

  const rows = [...normalizeList(response.data)];
  let nextUrl = response.data.next;
  let pageCount = 1;

  while (nextUrl && pageCount < 20) {
    const nextResponse = await apiClient.get(nextUrl);
    rows.push(...normalizeList(nextResponse.data));
    nextUrl = nextResponse.data?.next;
    pageCount += 1;
  }

  return rows;
}

export async function getResource(path) {
  const response = await apiClient.get(path);
  return response.data;
}

export async function createResource(path, payload) {
  const response = await apiClient.post(path, payload);
  return response.data;
}

export async function uploadResource(path, payload) {
  const response = await apiClient.post(path, payload, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function updateResource(path, payload) {
  const response = await apiClient.patch(path, payload);
  return response.data;
}

export async function postAction(path, payload = {}) {
  const response = await apiClient.post(path, payload);
  return response.data;
}
