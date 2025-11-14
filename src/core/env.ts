export const ENV = {
  API_URL: import.meta.env.VITE_API_URL,
  FB_API_KEY: import.meta.env.VITE_FB_API_KEY,
  FB_AUTH_DOMAIN: import.meta.env.VITE_FB_AUTH_DOMAIN,
  FB_DATABASE_URL: import.meta.env.VITE_FB_DATABASE_URL,
  FB_PROJECT_ID: import.meta.env.VITE_FB_PROJECT_ID,
  FB_APP_ID: import.meta.env.VITE_FB_APP_ID,
} as const;
