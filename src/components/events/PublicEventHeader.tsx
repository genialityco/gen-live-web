import { Card, Group, Title, Text } from "@mantine/core";
import dayjs from "dayjs";
import "dayjs/locale/es";

interface PublicEventHeaderProps {
  title: string;
  startsAt?: string | null;
  orgName?: string | null;
  logoUrl?: string | null;
}

/**
 * Cabecera de las páginas PÚBLICAS (informe / métricas): nombre y fecha del
 * evento, con el logo y nombre de la organización si están disponibles.
 */
export default function PublicEventHeader({
  title,
  startsAt,
  orgName,
  logoUrl,
}: PublicEventHeaderProps) {
  const dateLabel = startsAt
    ? dayjs(startsAt).locale("es").format("D [de] MMMM [de] YYYY, HH:mm")
    : null;

  return (
    <Card withBorder radius="md" p="md" mb="lg">
      <Group gap="md" wrap="nowrap" align="center">
        {logoUrl && (
          <img
            src={logoUrl}
            alt={orgName ?? "Logo"}
            style={{ height: 44, objectFit: "contain" }}
          />
        )}
        <div>
          <Title order={2} style={{ lineHeight: 1.2 }}>
            {title}
          </Title>
          {dateLabel && (
            <Text size="sm" c="dimmed">
              {dateLabel}
            </Text>
          )}
          {orgName && (
            <Text size="xs" c="dimmed">
              {orgName}
            </Text>
          )}
        </div>
      </Group>
    </Card>
  );
}
