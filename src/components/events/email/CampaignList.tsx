import { useState, useEffect, useCallback } from "react";
import {
  Stack,
  Group,
  Button,
  Text,
  Badge,
  Table,
  Loader,
  Center,
  Alert,
  ActionIcon,
} from "@mantine/core";
import { IconPlus, IconChevronRight } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  listCampaigns,
  type EmailCampaign,
  type CampaignStatus,
} from "../../../api/email-campaign";
import CreateCampaignModal from "./CreateCampaignModal";
import type { EmailTemplate } from "../../../api/event-email";

interface CampaignListProps {
  orgId: string;
  eventId: string;
  onSelect: (campaignId: string) => void;
  templates: EmailTemplate[];
}

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Borrador",
  sending: "Enviando...",
  completed: "Completada",
  failed: "Fallida",
  cancelled: "Cancelada",
};

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "gray",
  sending: "blue",
  completed: "green",
  failed: "red",
  cancelled: "orange",
};

const AUDIENCE_LABELS: Record<string, string> = {
  event_users: "Registrados al evento",
  org_attendees: "Base de contactos",
  both: "Ambos",
};

export default function CampaignList({
  orgId,
  eventId,
  onSelect,
  templates,
}: CampaignListProps) {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listCampaigns(orgId, eventId);
      setCampaigns(data);
    } catch {
      notifications.show({
        title: "Error",
        message: "No se pudieron cargar las campañas",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }, [orgId, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600} size="sm" c="dimmed">
            {campaigns.length} campaña{campaigns.length !== 1 ? "s" : ""}
          </Text>
          <Button
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={() => setModalOpen(true)}
          >
            Nueva campaña
          </Button>
        </Group>

        {campaigns.length === 0 ? (
          <Alert color="gray" title="Sin campañas">
            Aún no hay campañas de email para este evento. Crea la primera.
          </Alert>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Audiencia</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Enviados / Total</Table.Th>
                <Table.Th>Fecha</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {campaigns.map((c) => (
                <Table.Tr
                  key={c._id}
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelect(c._id)}
                >
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {c.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {AUDIENCE_LABELS[c.targetAudience] ?? c.targetAudience}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={STATUS_COLORS[c.status]}
                      variant={c.status === "sending" ? "dot" : "light"}
                    >
                      {STATUS_LABELS[c.status]}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {c.stats.sent.toLocaleString()} /{" "}
                      {c.stats.total.toLocaleString()}
                      {c.stats.failed + c.stats.rejected > 0 && (
                        <Text span size="xs" c="red" ml={4}>
                          ({c.stats.failed + c.stats.rejected} errores)
                        </Text>
                      )}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {new Date(c.createdAt).toLocaleDateString("es", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" color="gray">
                      <IconChevronRight size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>

      <CreateCampaignModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        orgId={orgId}
        eventId={eventId}
        templates={templates}
        onCreated={(campaign, sendNow) => {
          setModalOpen(false);
          if (sendNow) {
            onSelect(campaign._id);
          } else {
            setCampaigns((prev) => [campaign, ...prev]);
          }
        }}
      />
    </>
  );
}
