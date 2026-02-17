import { Stack, Title, Card } from "@mantine/core";
import { type Org } from "../../api/orgs";
import { type EventItem } from "../../api/events";
import EmailTemplateEditor from "./email/EmailTemplateEditor";

interface EventAdminEmailProps {
  org: Org;
  event: EventItem;
}

export default function EventAdminEmail({
  org,
  event,
}: EventAdminEmailProps) {
  return (
    <Stack gap="md">
      <Title order={2}>Email de bienvenida</Title>

      <Card withBorder radius="lg" p="lg">
        <EmailTemplateEditor orgId={org._id} eventId={event._id} />
      </Card>
    </Stack>
  );
}
