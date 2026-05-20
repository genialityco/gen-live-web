import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { MantineProvider, createTheme } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { Notifications } from "@mantine/notifications";
import { AuthProvider } from "../auth/AuthProvider";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "dayjs/locale/es";

// 👇 IMPORTAR RTDB
import { rtdb } from "../core/firebase";
import { ref as r, onValue } from "firebase/database";

// URL de emergencia a donde quieres mandar a TODOS
const EMERGENCY_URL =
  "https://gen-live-web.netlify.app/org/reddeexpertosdmace.com/event/respondiendo-desafio-diabete-2025";

const CACHE_VERSION = "may2025";

const DOMAIN_REDIRECTS: Record<string, string> = {
  "reddeexpertosdmace.com": "/org/reddeexpertosdmacecom",
  "www.reddeexpertosdmace.com": "/org/reddeexpertosdmacecom",
  "endocrinocampusace.com": "/org/endocrinocampusace/event/metas-teoria-paciente",
  "www.endocrinocampusace.com": "/org/endocrinocampusace/event/metas-teoria-paciente",
  "eventosolara.com": "/org/evento-solara/event/enfermedades-raras-latam",
  "www.eventosolara.com": "/org/evento-solara/event/enfermedades-raras-latam",
  "endocrinocampus.com": "/org/endocrinocampus/event/novonordiskmarzo2026",
  "www.endocrinocampus.com": "/org/endocrinocampus/event/novonordiskmarzo2026",
  "ace-lipidxperience.com": "/org/procaps",
  "www.ace-lipidxperience.com": "/org/procaps",
  "campusaceendocrino.com": "/org/campusaceendocrino-com",
  "www.campusaceendocrino.com": "/org/campusaceendocrino-com",
};

// Define estilos globales para notificaciones usando el tema de Mantine
const theme = createTheme({
  components: {
    Notification: {
      styles: {
        root: {
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
          border: "2px solid",
          borderRadius: "12px",
          padding: "16px 20px",
          minHeight: "70px",
          backgroundColor: "white",
          '&[data-color="red"]': {
            borderColor: "#fa5252",
            backgroundColor: "#fff5f5",
          },
          '&[data-color="green"]': {
            borderColor: "#51cf66",
            backgroundColor: "#f4fce3",
          },
          '&[data-color="orange"]': {
            borderColor: "#ff922b",
            backgroundColor: "#fff4e6",
          },
          '&[data-color="blue"]': {
            borderColor: "#4dabf7",
            backgroundColor: "#e7f5ff",
          },
        },
        title: {
          fontWeight: 700,
          fontSize: "16px",
          marginBottom: "6px",
        },
        description: {
          fontSize: "14px",
          lineHeight: 1.5,
        },
        closeButton: {
          "&:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.05)",
          },
        },
      },
    },
  },
});

export default function App() {
  // Limpieza de caché cuando llega ?v=may2025
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("v");
    if (v && v !== localStorage.getItem("_app_version")) {
      localStorage.removeItem("last-registered-email");
      localStorage.removeItem("user-email");
      // Limpiar cookies de sesión (no las de auth de Firebase)
      document.cookie.split(";").forEach((c) => {
        const key = c.split("=")[0].trim();
        if (!key.startsWith("firebase") && !key.startsWith("__session")) {
          document.cookie = `${key}=;expires=${new Date(0).toUTCString()};path=/`;
        }
      });
      localStorage.setItem("_app_version", v);
      // Quitar el param de la URL sin recargar
      params.delete("v");
      const clean = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, "", clean);
    }
  }, []);

  // Redirección por dominio personalizado
  useEffect(() => {
    const hostname = window.location.hostname;
    const targetPath = DOMAIN_REDIRECTS[hostname];
    if (targetPath && window.location.pathname === "/") {
      window.location.replace(`${targetPath}?v=${CACHE_VERSION}`);
    }
  }, []);

  // 🔴 Kill switch global
  useEffect(() => {
    // Si quieres que SOLO aplique en producción:
    // if (process.env.NODE_ENV !== "production") return;

    const emergencyRef = r(rtdb, "/global/emergencyOpen");

    const unsub = onValue(emergencyRef, (snap) => {
      const active = !!snap.val();
      if (active) {
        console.warn(
          "[EMERGENCY] Flag global activado. Redirigiendo a:",
          EMERGENCY_URL
        );
        // Redirección hard (sale completamente de la SPA)
        window.location.href = EMERGENCY_URL;
      }
    });

    return () => {
      unsub();
    };
  }, []);

  return (
    <MantineProvider theme={theme}>
      <DatesProvider
        settings={{ locale: "es", firstDayOfWeek: 1, weekendDays: [0, 6] }}
      >
        <AuthProvider>
          <Notifications
            position="top-center"
            autoClose={5000}
            limit={3}
            zIndex={9999}
            containerWidth={420}
            transitionDuration={300}
            styles={{
              root: {
                marginTop: "20px",
              },
            }}
          />
          <RouterProvider router={router} />
        </AuthProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
