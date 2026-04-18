import axios from "axios";

const backendUrl =
  import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: backendUrl,
  timeout: 5000,
});
