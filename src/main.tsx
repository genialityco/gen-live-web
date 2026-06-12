import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./auth/AuthProvider";
import App from "./app/App";
import { captureUtms } from "./lib/utmTracking";

captureUtms();

// Si llegamos hasta aquí, el bundle actual cargó bien: limpiamos el flag
// para permitir un futuro auto-reload si vuelve a fallar un chunk.
const RELOAD_FLAG = "vite-preload-reload";
sessionStorage.removeItem(RELOAD_FLAG);

// Tras un nuevo deploy, los chunks con hash viejo dejan de existir en el
// servidor. Si un import() dinámico (rutas lazy) falla por esto, recargamos
// una sola vez para obtener el index.html y los assets actualizados.
window.addEventListener("vite:preloadError", () => {
  if (sessionStorage.getItem(RELOAD_FLAG)) return;
  sessionStorage.setItem(RELOAD_FLAG, "1");
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
