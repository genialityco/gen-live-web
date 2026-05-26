import { Stack, Title, Text } from "@mantine/core";
import SuppressedEmailsManager from "../../components/organizations/SuppressedEmailsManager";

interface Props {
  orgId: string;
}

export default function SuppressedEmailsView({ orgId }: Props) {
  return (
    <Stack gap="xl">
      <div>
        <Title order={1}>Emails suprimidos</Title>
        <Text c="dimmed" size="lg">
          Direcciones bloqueadas por bounces permanentes o quejas de spam
        </Text>
      </div>

      <SuppressedEmailsManager orgId={orgId} />
    </Stack>
  );
}
