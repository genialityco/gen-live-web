import { Stack, Title, Text } from "@mantine/core";
import { OrgAttendeesManager } from "../../components/organizations";

interface AdminAttendeesViewProps {
  orgId: string;
  orgName: string;
}

export default function AdminAttendeesView({ orgId, orgName }: AdminAttendeesViewProps) {
  return (
    <Stack gap="xl">
      <div>
        <Title order={1}>Base de registros</Title>
        <Text c="dimmed" size="lg">
          Gestiona todos los usuarios registrados en {orgName}
        </Text>
      </div>
      
      <OrgAttendeesManager orgId={orgId} orgName={orgName} />
    </Stack>
  );
}