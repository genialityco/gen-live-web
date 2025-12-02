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
