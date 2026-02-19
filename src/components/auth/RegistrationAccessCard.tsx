import {
  Card,
  Stack,
  Title,
  Text,
  Button,
  Group,
  Box,
  SimpleGrid,
  Affix,
  useMantineTheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconBrandWhatsapp, IconArrowLeft } from "@tabler/icons-react";

interface RegistrationAccessCardProps {
  formTitle?: string;
  onSelectLogin: () => void;
  onSelectRegister: () => void;
  onCancel: () => void;
  whatsappHref?: string;
}

function OptionCard({
  emoji,
  title,
  buttonLabel,
  variant,
  onClick,
}: {
  emoji: string;
  title: string;
  buttonLabel: string;
  variant: "filled" | "light";
  onClick: () => void;
}) {
  const theme = useMantineTheme();

  return (
    <Card
      withBorder
      radius="xl"
      padding="xl"
      onClick={onClick}
      style={{
        cursor: "pointer",
        textAlign: "center",
        transition: "all 180ms ease",
      }}
      styles={{
        root: {
          "&:hover": {
            transform: "translateY(-4px)",
            boxShadow: theme.shadows.lg,
            borderColor: theme.colors[theme.primaryColor][5],
          },
        },
      }}
    >
      <Stack gap="md" align="center">
        <Text
          style={{
            fontSize: "3rem",
            lineHeight: 1,
          }}
        >
          {emoji}
        </Text>

        <Title order={4}>{title}</Title>

        <Button fullWidth radius="xl" size="md" variant={variant}>
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
    <Card
      radius="2xl"
      padding="xl"
      withBorder
      shadow="sm"
      style={{
        position: "relative",
        background:
          "radial-gradient(600px 300px at 10% 0%, rgba(34,139,230,.08), transparent 60%), #fff",
      }}
    >
      <Stack gap="xl">
        <Box ta="center">
          <Title order={2} fw={900}>
            {formTitle ?? "¿Cómo deseas continuar?"}
          </Title>
        </Box>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <OptionCard
            emoji="🔑"
            title="Ya estoy registrado"
            buttonLabel="Ingresar"
            variant="filled"
            onClick={onSelectLogin}
          />

          <OptionCard
            emoji="📝"
            title="Primera vez"
            buttonLabel="Registrarme ahora"
            variant="light"
            onClick={onSelectRegister}
          />
        </SimpleGrid>

        <Group justify="center">
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            radius="xl"
            onClick={onCancel}
          >
            Volver al evento
          </Button>
        </Group>
      </Stack>

      {/* WhatsApp flotante */}
      <Affix
        position={{
          bottom: 20,
          right: isMobile ? undefined : 20,
          left: isMobile ? 20 : undefined,
        }}
      >
        <Button
          component="a"
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          leftSection={<IconBrandWhatsapp size={18} />}
          color="green"
          radius="xl"
          size="md"
          fullWidth={isMobile}
          style={{
            boxShadow: "0 12px 30px rgba(0,0,0,.18)",
            width: isMobile ? "calc(100vw - 40px)" : "auto",
          }}
        >
          Soporte Técnico
        </Button>
      </Affix>
    </Card>
  );
}
