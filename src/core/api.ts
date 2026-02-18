import axios from "axios";
import { auth } from "./firebase";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use(async (config) => {
  try {
    const t = await auth.currentUser?.getIdToken();
    if (t) config.headers.Authorization = `Bearer ${t}`;
  } catch {
    // Token expirado o dominio no autorizado — continuar sin token
  }
  return config;
});
