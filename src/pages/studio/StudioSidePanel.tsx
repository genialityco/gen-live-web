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
import { InvitationManager } from "../../components/studio/InvitationManager";
import { FrameControls } from "./FrameControls";
import { BackgroundControls } from "./BackgroundControls";
import { MediaLibrary } from "./MediaLibrary";

type Props = {
  role: "host" | "speaker";
  eventSlug: string;
  disabled?: boolean;

  showFrame: boolean;
  frameUrl: string;
  backgroundUrl: string;
  backgroundType: "image" | "gif" | "video";
  activeVisualId?: string;
  activeAudioId?: string;

  onRefreshFrameConfig: () => void; // renombrable luego
};

export const StudioSidePanel: React.FC<Props> = ({
  role,
  eventSlug,
  disabled,
  showFrame,
  frameUrl,
  backgroundUrl,
  backgroundType,
  onRefreshFrameConfig,
  activeVisualId,
  activeAudioId,
}) => {
  const isSpeaker = role === "speaker";
  return (
    <Tabs defaultValue={isSpeaker ? "info" : "control"} keepMounted={false} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Tabs.List grow>
        {!isSpeaker && <Tabs.Tab value="control">Control</Tabs.Tab>}
        {!isSpeaker && <Tabs.Tab value="media">Biblioteca</Tabs.Tab>}
        {!isSpeaker && <Tabs.Tab value="invites">Invitaciones</Tabs.Tab>}
        {!isSpeaker && <Tabs.Tab value="requests">Requests</Tabs.Tab>}
      </Tabs.List>

      <ScrollArea mt="md" style={{ flex: 1 }}>
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
                </Stack>
              </Paper>

              <Paper p="sm" radius="md" withBorder>
                <BackgroundControls
                  eventSlug={eventSlug}
                  backgroundUrl={backgroundUrl}
                  backgroundType={backgroundType}
                  onUpdate={onRefreshFrameConfig}
                  disabled={disabled}
                />
              </Paper>

              <Paper p="sm" radius="md" withBorder>
                <Stack gap="sm">
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
          <Tabs.Panel value="media">
            <MediaLibrary
              eventSlug={eventSlug}
              activeVisualId={activeVisualId}
              activeAudioId={activeAudioId}
              onConfigChange={onRefreshFrameConfig}
              disabled={disabled}
            />
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
      </ScrollArea>
    </Tabs>
  );
};
