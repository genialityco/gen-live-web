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
} from "@mantine/core";
import { IconBrandWhatsapp } from "@tabler/icons-react";

interface RegistrationAccessCardProps {
  formTitle?: string;
  formDescription?: string;
  onSelectLogin: () => void;
  onSelectRegister: () => void;
  onCancel: () => void;
  whatsappHref?: string;
}

export function RegistrationAccessCard({
  onSelectLogin,
  onSelectRegister,
  onCancel,
  whatsappHref = "https://wa.me/+573224387523?",
}: RegistrationAccessCardProps) {
  return (
    <Card shadow="md" padding="xl" radius="lg" withBorder>
      <Stack gap="xl" align="center">
        <Box ta="center">
          <Title order={2} mb="sm">
            ¿Cómo deseas continuar?
          </Title>
        </Box>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" w="100%" maw={600}>
          {/* Opción: Ya registrado */}
          <Card
            withBorder
            shadow="sm"
            padding="lg"
            radius="md"
            style={{ cursor: "pointer" }}
            onClick={onSelectLogin}
          >
            <Stack gap="md" align="center" ta="center">
              <Text size="2rem">🔑</Text>
              <Stack gap="xs">
                <Title order={4} size="h5">
                  Ya estoy registrado
                </Title>
              </Stack>
              <Button fullWidth variant="filled">
                Ingresar
              </Button>
            </Stack>
          </Card>

          {/* Opción: Primera vez */}
          <Card
            withBorder
            shadow="sm"
            padding="lg"
            radius="md"
            style={{ cursor: "pointer" }}
            onClick={onSelectRegister}
          >
            <Stack gap="md" align="center" ta="center">
              <Text size="2rem">📝</Text>
              <Stack gap="xs">
                <Title order={4} size="h5">
                  Primera vez
                </Title>
              </Stack>
              <Button fullWidth variant="light">
                Registrarme ahora
              </Button>
            </Stack>
          </Card>
        </SimpleGrid>

        <Group gap="sm" mt="md">
          <Button variant="subtle" size="sm" onClick={onCancel}>
            ← Volver al evento
          </Button>
        </Group>

        <Affix position={{ bottom: 20, right: 20 }}>
          <Button
            component="a"
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            leftSection={<IconBrandWhatsapp size={18} />}
            color="green"
            radius="xl"
            size="md"
            variant="filled"
            styles={{
              root: {
                boxShadow: "0 10px 24px rgba(0,0,0,.12)",
                paddingInline: 16,
              },
            }}
          >
            Soporte Técnico
          </Button>
        </Affix>
      </Stack>
    </Card>
  );
}
