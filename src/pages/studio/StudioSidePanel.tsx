// src/components/live/StudioSidePanel.tsx
import React from "react";
import {
  Divider,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";

import { LiveConfigPanel } from "./LiveConfigPanel";
import { JoinRequestsPanel } from "./JoinRequestsPanel";
import { FrameControls } from "../../components/FrameControls";
import { InvitationManager } from "../../components/studio/InvitationManager";

type Props = {
  role: "host" | "speaker";
  eventSlug: string;
  disabled?: boolean;

  showFrame: boolean;
  frameUrl: string;
  onRefreshFrameConfig: () => void;
};

export const StudioSidePanel: React.FC<Props> = ({
  role,
  eventSlug,
  disabled,
  showFrame,
  frameUrl,
  onRefreshFrameConfig,
}) => {
  const isSpeaker = role === "speaker";
  return (
    <Tabs defaultValue={isSpeaker ? "info" : "control"} keepMounted={false}>
      <Tabs.List grow>
        {!isSpeaker && <Tabs.Tab value="control">Control</Tabs.Tab>}
        {!isSpeaker && <Tabs.Tab value="invites">Invitaciones</Tabs.Tab>}
        {!isSpeaker && <Tabs.Tab value="requests">Requests</Tabs.Tab>}
        <Tabs.Tab value="info">Info</Tabs.Tab>
      </Tabs.List>

      <ScrollArea mt="md" h="calc(100dvh - 140px)">
        {!isSpeaker && (
          <Tabs.Panel value="control">
            <Stack gap="md">
              <LiveConfigPanel eventSlug={eventSlug} disabled={disabled} />

            <Paper p="sm" radius="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={600}>Marco gráfico</Text>
                  <Text size="xs" c="dimmed">
                    {showFrame ? "Activo" : "Inactivo"}
                  </Text>
                </Group>

                <FrameControls
                  eventSlug={eventSlug}
                  showFrame={showFrame}
                  frameUrl={frameUrl}
                  onUpdate={onRefreshFrameConfig}
                />

                <Divider />

                <Text size="xs" c="dimmed">
                  Tip: el monitor muestra solo los que están “En escena”.
                </Text>
              </Stack>
            </Paper>
          </Stack>
        </Tabs.Panel>
        )}

        {!isSpeaker && (
          <Tabs.Panel value="invites">
            <InvitationManager eventSlug={eventSlug} disabled={disabled} />
          </Tabs.Panel>
        )}

        {!isSpeaker && (
          <Tabs.Panel value="requests">
            <JoinRequestsPanel eventSlug={eventSlug} />
          </Tabs.Panel>
        )}

        <Tabs.Panel value="info">
          <Paper p="sm" radius="md" withBorder>
            <Stack gap="xs">
              <Text fw={600}>Atajos / Tips</Text>
              <Text size="sm" c="dimmed">
                • “Subir/Bajar” controla quién sale al programa.
              </Text>
              <Text size="sm" c="dimmed">
                • “Pin” fuerza modo Speaker con ese usuario.
              </Text>
            </Stack>
          </Paper>
        </Tabs.Panel>
      </ScrollArea>
    </Tabs>
  );
};
