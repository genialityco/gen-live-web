import axios from "axios";
import { auth } from "./firebase";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use(async (config) => {
  const t = await auth.currentUser?.getIdToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
