// src/components/auth/RegistrationSummary.tsx
import { useState } from "react";
import {
  Stack,
  Button,
  Text,
  Group,
  Badge,
  Card,
  Title,
  ThemeIcon,
  Anchor,
} from "@mantine/core";
import {
  IconCheck,
  IconEdit,
  IconArrowRight,
  IconUserCheck,
  IconUserSearch,
} from "@tabler/icons-react";
import type { RegistrationForm } from "../../types";
import type { FoundRegistration } from "../../api/events";
import { transformRegistrationDataToLabels } from "../../utils/formDataTransform";

/** Convierte un label que puede traer HTML (ej. consentimientos) a texto plano. */
function stripHtml(html: string): string {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
}

const LONG_THRESHOLD = 90;

/** Fila clave/valor. Si el label o el valor es muy largo, se trunca y se ofrece "Ver más". */
function SummaryRow({
  label,
  value,
  showBorder,
}: {
  label: string;
  value: string;
  showBorder: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = label.length > LONG_THRESHOLD || value.length > LONG_THRESHOLD;
  const wrapStyle = {
    borderTop: showBorder ? "1px solid var(--mantine-color-gray-2)" : undefined,
  };

  // Contenido largo → apilado a ancho completo, con truncado + "Ver más"
  if (isLong) {
    return (
      <Stack gap={4} px="md" py="xs" style={wrapStyle}>
        <Text size="xs" c="dimmed" fw={600} lineClamp={expanded ? undefined : 2}>
          {label}
        </Text>
        <Text
          size="sm"
          fw={500}
          style={{ wordBreak: "break-word" }}
          lineClamp={expanded ? undefined : 3}
        >
          {value}
        </Text>
        <Anchor
          component="button"
          type="button"
          size="xs"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Ver menos" : "Ver más"}
        </Anchor>
      </Stack>
    );
  }

  // Contenido corto → label / valor lado a lado
  return (
    <Group
      justify="space-between"
      align="flex-start"
      wrap="nowrap"
      gap="md"
      px="md"
      py="xs"
      style={wrapStyle}
    >
      <Text
        size="sm"
        c="dimmed"
        style={{ flexShrink: 0, maxWidth: "45%" }}
        title={label}
      >
        {label}
      </Text>
      <Text
        size="sm"
        fw={500}
        style={{ textAlign: "right", wordBreak: "break-word" }}
      >
        {value}
      </Text>
    </Group>
  );
}

interface RegistrationSummaryProps {
  registration: FoundRegistration;
  formConfig: RegistrationForm;
  onContinueToEvent: () => void;
  onUpdateInfo: () => void;
}

export function RegistrationSummary({
  registration,
  formConfig,
  onContinueToEvent,
  onUpdateInfo,
}: RegistrationSummaryProps) {
  const { attendee, isRegistered } = registration;
  if (!attendee) return null;

  const sortedFields = [...formConfig.fields].sort((a, b) => a.order - b.order);

  const readableData = transformRegistrationDataToLabels(
    attendee.registrationData,
    formConfig.fields
  );

  // Solo campos con valor y no ocultos (para la lista compacta)
  const visibleFields = sortedFields.filter((field) => {
    const v = attendee.registrationData[field.id];
    return !field.hidden && v !== undefined && v !== null && v !== "";
  });

  return (
    <Card withBorder radius="lg" p={{ base: "md", sm: "xl" }} shadow="sm">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <ThemeIcon
              size={42}
              radius="md"
              variant="light"
              color={isRegistered ? "green" : "blue"}
            >
              {isRegistered ? (
                <IconUserCheck size={24} stroke={1.6} />
              ) : (
                <IconUserSearch size={24} stroke={1.6} />
              )}
            </ThemeIcon>

            <div style={{ minWidth: 0 }}>
              <Title order={4} fw={600} style={{ lineHeight: 1.2 }}>
                Tu información de registro
              </Title>
              <Text size="sm" c="dimmed">
                Revisa que todo esté correcto antes de continuar.
              </Text>
            </div>
          </Group>

          <Badge
            color={isRegistered ? "green" : "blue"}
            variant="light"
            radius="sm"
            leftSection={isRegistered ? <IconCheck size={12} /> : undefined}
            style={{ flexShrink: 0 }}
          >
            {isRegistered ? "Registrado" : "Encontrado"}
          </Badge>
        </Group>

        {/* Datos: lista compacta clave/valor */}
        <Card withBorder radius="md" p={0}>
          {visibleFields.map((field, i) => (
            <SummaryRow
              key={field.id}
              label={stripHtml(field.label)}
              value={String(readableData[field.id] ?? "")}
              showBorder={i > 0}
            />
          ))}
        </Card>

        {/* Acciones */}
        <Stack gap="sm" mt={4}>
          <Button
            size="md"
            radius="md"
            fullWidth
            rightSection={<IconArrowRight size={18} />}
            onClick={onContinueToEvent}
          >
            Continuar al evento
          </Button>

          <Button
            variant="light"
            radius="md"
            fullWidth
            leftSection={<IconEdit size={18} />}
            onClick={onUpdateInfo}
          >
            Actualizar mi información
          </Button>
        </Stack>

        <Text size="xs" c="dimmed" ta="center">
          Si algo no coincide, actualiza tu información antes de continuar.
        </Text>
      </Stack>
    </Card>
  );
}
