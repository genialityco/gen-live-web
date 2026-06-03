import { useState, useEffect, useCallback } from "react";
import { Stack, Title, Card, Tabs, SegmentedControl, Group } from "@mantine/core";
import { type Org } from "../../api/orgs";
import { type EventItem } from "../../api/events";
import { fetchEventTemplates, type EmailTemplate } from "../../api/event-email";
import EmailTemplateEditor from "./email/EmailTemplateEditor";
import CampaignList from "./email/CampaignList";
import CampaignDetail from "./email/CampaignDetail";
import WaTemplateManager from "./whatsapp/WaTemplateManager";
import WaCampaignList from "./whatsapp/WaCampaignList";
import WaCampaignDetail from "./whatsapp/WaCampaignDetail";

interface EventAdminEmailProps {
  org: Org;
  event: EventItem;
}

export default function EventAdminEmail({ org, event }: EventAdminEmailProps) {
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedWaCampaignId, setSelectedWaCampaignId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await fetchEventTemplates(org._id, event._id);
      setTemplates(data);
    } catch {
      // silencioso
    }
  }, [org._id, event._id]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Resetear selección al cambiar de canal
  const handleChannelChange = (val: string) => {
    setChannel(val as "email" | "whatsapp");
    setSelectedCampaignId(null);
    setSelectedWaCampaignId(null);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={2}>Comunicaciones</Title>
        <SegmentedControl
          value={channel}
          onChange={handleChannelChange}
          data={[
            { label: "✉️  Email", value: "email" },
            { label: "💬  WhatsApp", value: "whatsapp" },
          ]}
        />
      </Group>

      {/* ── Canal Email ──────────────────────────────────────────────────────── */}
      {channel === "email" && (
        <Tabs defaultValue="templates">
          <Tabs.List>
            <Tabs.Tab value="templates">Plantillas</Tabs.Tab>
            <Tabs.Tab value="campaigns" onClick={loadTemplates}>Campañas masivas</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="templates" pt="md">
            <Tabs defaultValue="WELCOME">
              <Tabs.List>
                <Tabs.Tab value="WELCOME">Bienvenida</Tabs.Tab>
                <Tabs.Tab value="INVITATION">Invitación</Tabs.Tab>
                <Tabs.Tab value="REMINDER">Recordatorio</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="WELCOME" pt="md">
                <Card withBorder radius="lg" p="lg">
                  <EmailTemplateEditor orgId={org._id} eventId={event._id} type="WELCOME" />
                </Card>
              </Tabs.Panel>
              <Tabs.Panel value="INVITATION" pt="md">
                <Card withBorder radius="lg" p="lg">
                  <EmailTemplateEditor orgId={org._id} eventId={event._id} type="INVITATION" />
                </Card>
              </Tabs.Panel>
              <Tabs.Panel value="REMINDER" pt="md">
                <Card withBorder radius="lg" p="lg">
                  <EmailTemplateEditor orgId={org._id} eventId={event._id} type="REMINDER" />
                </Card>
              </Tabs.Panel>
            </Tabs>
          </Tabs.Panel>

          <Tabs.Panel value="campaigns" pt="md">
            {selectedCampaignId ? (
              <CampaignDetail
                campaignId={selectedCampaignId}
                onBack={() => setSelectedCampaignId(null)}
              />
            ) : (
              <CampaignList
                orgId={org._id}
                eventId={event._id}
                onSelect={setSelectedCampaignId}
                templates={templates}
              />
            )}
          </Tabs.Panel>
        </Tabs>
      )}

      {/* ── Canal WhatsApp ───────────────────────────────────────────────────── */}
      {channel === "whatsapp" && (
        <Tabs defaultValue="campaigns">
          <Tabs.List>
            <Tabs.Tab value="campaigns">Campañas</Tabs.Tab>
            <Tabs.Tab value="templates">Templates</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="campaigns" pt="md">
            {selectedWaCampaignId ? (
              <WaCampaignDetail
                campaignId={selectedWaCampaignId}
                onBack={() => setSelectedWaCampaignId(null)}
              />
            ) : (
              <WaCampaignList
                orgId={org._id}
                eventId={event._id}
                onSelect={setSelectedWaCampaignId}
              />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="templates" pt="md">
            <WaTemplateManager />
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  );
}
