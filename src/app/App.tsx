import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { Notifications } from "@mantine/notifications";
import { AuthProvider } from "../auth/AuthProvider";
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import 'dayjs/locale/es';

export default function App() {
  return (
    <MantineProvider defaultColorScheme="light">
      <DatesProvider settings={{ locale: 'es', firstDayOfWeek: 1, weekendDays: [0, 6] }}>
        <AuthProvider>
          <Notifications />
          <RouterProvider router={router} />
        </AuthProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
