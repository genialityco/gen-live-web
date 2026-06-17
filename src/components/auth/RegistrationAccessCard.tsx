import { useState } from "react";
import {
  Card,
  Stack,
  Title,
  Text,
  Button,
  Group,
  ThemeIcon,
  SimpleGrid,
  Affix,
  useMantineTheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconBrandWhatsapp,
  IconArrowLeft,
  IconLogin2,
  IconUserPlus,
  type Icon,
} from "@tabler/icons-react";

interface RegistrationAccessCardProps {
  formTitle?: string;
  onSelectLogin: () => void;
  onSelectRegister: () => void;
  onCancel: () => void;
  whatsappHref?: string;
}

function OptionCard({
  icon: IconComponent,
  title,
  description,
  buttonLabel,
  variant,
  onClick,
}: {
  icon: Icon;
  title: string;
  description: string;
  buttonLabel: string;
  variant: "filled" | "default";
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Card
      withBorder
      radius="md"
      padding="lg"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        cursor: "pointer",
        height: "100%",
        transition: "border-color 150ms ease, background-color 150ms ease",
        borderColor: hovered
          ? "var(--mantine-primary-color-filled)"
          : undefined,
        backgroundColor: hovered
          ? "var(--mantine-primary-color-light)"
          : undefined,
      }}
    >
      <Stack
        gap="md"
        align="center"
        h="100%"
        justify="space-between"
        ta="center"
      >
        <Stack gap="xs" align="center">
          <ThemeIcon size={52} radius="md" variant="light">
            <IconComponent size={26} stroke={1.6} />
          </ThemeIcon>

          <Stack gap={2} align="center">
            <Title order={4} fw={600}>
              {title}
            </Title>
            <Text size="sm" c="dimmed" maw={240}>
              {description}
            </Text>
          </Stack>
        </Stack>

        <Button component="div" fullWidth radius="md" size="md" variant={variant}>
          {buttonLabel}
        </Button>
      </Stack>
    </Card>
  );
}

export function RegistrationAccessCard({
  formTitle,
  onSelectLogin,
  onSelectRegister,
  onCancel,
  whatsappHref = "https://wa.me/+573224387523?",
}: RegistrationAccessCardProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  return (
    <Card radius="lg" p={{ base: "md", sm: "xl" }} withBorder shadow="sm" pos="relative">
      <Stack gap="xl">
        <Stack gap={6} ta="center" align="center">
          <Title order={2} fw={700} fz={{ base: "1.4rem", sm: "1.7rem" }}>
            {formTitle ?? "¿Cómo deseas continuar?"}
          </Title>
          <Text c="dimmed" size="sm" maw={420}>
            Elige una opción para acceder al evento.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={{ base: "md", sm: "lg" }}>
          <OptionCard
            icon={IconLogin2}
            title="Ya estoy registrado"
            description="Ingresa con los datos de tu registro."
            buttonLabel="Ingresar"
            variant="filled"
            onClick={onSelectLogin}
          />

          <OptionCard
            icon={IconUserPlus}
            title="Primera vez"
            description="Crea tu acceso en un minuto."
            buttonLabel="Registrarme"
            variant="default"
            onClick={onSelectRegister}
          />
        </SimpleGrid>

        <Group justify="center">
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconArrowLeft size={16} />}
            radius="md"
            onClick={onCancel}
          >
            Volver al evento
          </Button>
        </Group>
      </Stack>

      {/* Soporte por WhatsApp (flotante, discreto) */}
      <Affix
        position={{
          bottom: `calc(20px + env(safe-area-inset-bottom, 0px))`,
          right: 20,
        }}
      >
        <Button
          component="a"
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          leftSection={<IconBrandWhatsapp size={18} />}
          color="green"
          variant="light"
          radius="xl"
          size={isMobile ? "sm" : "md"}
        >
          {isMobile ? "Soporte" : "Soporte técnico"}
        </Button>
      </Affix>
    </Card>
  );
}
