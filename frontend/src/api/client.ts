import axios from "axios";

const backendUrl =
  import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "/api";

export const apiClient = axios.create({
  baseURL: backendUrl,
  timeout: 5000,
});
