import { useState, useEffect, useCallback } from "react";
import { Stack, Title, Card, Tabs } from "@mantine/core";
import { type Org } from "../../api/orgs";
import { type EventItem } from "../../api/events";
import { fetchEventTemplates, type EmailTemplate } from "../../api/event-email";
import EmailTemplateEditor from "./email/EmailTemplateEditor";
import CampaignList from "./email/CampaignList";
import CampaignDetail from "./email/CampaignDetail";

interface EventAdminEmailProps {
  org: Org;
  event: EventItem;
}

export default function EventAdminEmail({ org, event }: EventAdminEmailProps) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null
  );
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

  return (
    <Stack gap="md">
      <Title order={2}>Emails</Title>

      <Tabs defaultValue="templates">
        <Tabs.List>
          <Tabs.Tab value="templates">Plantillas</Tabs.Tab>
          <Tabs.Tab value="campaigns" onClick={loadTemplates}>
            Campañas masivas
          </Tabs.Tab>
        </Tabs.List>

        {/* ── Plantillas ── */}
        <Tabs.Panel value="templates" pt="md">
          <Tabs defaultValue="WELCOME">
            <Tabs.List>
              <Tabs.Tab value="WELCOME">Bienvenida</Tabs.Tab>
              <Tabs.Tab value="INVITATION">Invitación</Tabs.Tab>
              <Tabs.Tab value="REMINDER">Recordatorio</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="WELCOME" pt="md">
              <Card withBorder radius="lg" p="lg">
                <EmailTemplateEditor
                  orgId={org._id}
                  eventId={event._id}
                  type="WELCOME"
                />
              </Card>
            </Tabs.Panel>

            <Tabs.Panel value="INVITATION" pt="md">
              <Card withBorder radius="lg" p="lg">
                <EmailTemplateEditor
                  orgId={org._id}
                  eventId={event._id}
                  type="INVITATION"
                />
              </Card>
            </Tabs.Panel>

            <Tabs.Panel value="REMINDER" pt="md">
              <Card withBorder radius="lg" p="lg">
                <EmailTemplateEditor
                  orgId={org._id}
                  eventId={event._id}
                  type="REMINDER"
                />
              </Card>
            </Tabs.Panel>
          </Tabs>
        </Tabs.Panel>

        {/* ── Campañas ── */}
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
    </Stack>
  );
}
