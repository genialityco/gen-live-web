// src/components/live/StudioSidePanel.tsx
import React from "react";
import {
  Accordion,
  Box,
  Divider,
  ScrollArea,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import {
  IconBroadcast,
  IconLayout,
  IconUsersGroup,
} from "@tabler/icons-react";

import { LiveConfigPanel } from "./LiveConfigPanel";
import { JoinRequestsPanel } from "./JoinRequestsPanel";
import { InvitationManager } from "../../components/studio/InvitationManager";
import { FrameControls } from "./FrameControls";
import { BackgroundControls } from "./BackgroundControls";
import { MediaLibrary } from "./MediaLibrary";
import { TileAppearancePanel } from "./TileAppearancePanel";

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
  presentationSlide?: number;

  onRefreshFrameConfig: () => void;
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
  presentationSlide,
}) => {
  if (role === "speaker") return null;

  return (
    <Tabs
      defaultValue="stream"
      keepMounted={false}
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <Tabs.List grow>
        <Tabs.Tab value="stream" leftSection={<IconBroadcast size={15} />}>
          Transmisión
        </Tabs.Tab>
        <Tabs.Tab value="scene" leftSection={<IconLayout size={15} />}>
          Escena
        </Tabs.Tab>
        <Tabs.Tab value="people" leftSection={<IconUsersGroup size={15} />}>
          Personas
        </Tabs.Tab>
      </Tabs.List>

      <ScrollArea mt="xs" style={{ flex: 1 }}>

        {/* ── TRANSMISIÓN ─────────────────────────────────────────── */}
        <Tabs.Panel value="stream">
          <LiveConfigPanel eventSlug={eventSlug} disabled={disabled} defaultOpened />
        </Tabs.Panel>

        {/* ── ESCENA ──────────────────────────────────────────────── */}
        <Tabs.Panel value="scene">
          <Stack gap="sm">
            <MediaLibrary
              eventSlug={eventSlug}
              activeVisualId={activeVisualId}
              activeAudioId={activeAudioId}
              onConfigChange={onRefreshFrameConfig}
              disabled={disabled}
              presentationSlide={presentationSlide}
            />

            <Divider label="Overlays" labelPosition="center" />

            <Accordion variant="contained" radius="md" chevronPosition="right">

              <Accordion.Item value="frame">
                <Accordion.Control>
                  <Box>
                    <Text size="sm" fw={600}>Marco gráfico</Text>
                    <Text size="xs" c="dimmed">
                      {frameUrl
                        ? showFrame ? "Activo" : "Cargado · inactivo"
                        : "Sin imagen"}
                    </Text>
                  </Box>
                </Accordion.Control>
                <Accordion.Panel>
                  <FrameControls
                    eventSlug={eventSlug}
                    showFrame={showFrame}
                    frameUrl={frameUrl}
                    onUpdate={onRefreshFrameConfig}
                  />
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="background">
                <Accordion.Control>
                  <Box>
                    <Text size="sm" fw={600}>Fondo del live</Text>
                    <Text size="xs" c="dimmed">
                      {backgroundUrl ? "Cargado" : "Sin fondo"}
                    </Text>
                  </Box>
                </Accordion.Control>
                <Accordion.Panel>
                  <BackgroundControls
                    eventSlug={eventSlug}
                    backgroundUrl={backgroundUrl}
                    backgroundType={backgroundType}
                    onUpdate={onRefreshFrameConfig}
                    disabled={disabled}
                  />
                </Accordion.Panel>
              </Accordion.Item>

            </Accordion>
          </Stack>
        </Tabs.Panel>

        {/* ── PERSONAS ────────────────────────────────────────────── */}
        <Tabs.Panel value="people">
          <Stack gap="sm">

            <InvitationManager eventSlug={eventSlug} disabled={disabled} />

            <Divider />

            <JoinRequestsPanel eventSlug={eventSlug} />

            <Accordion variant="contained" radius="md">
              <Accordion.Item value="appearance">
                <Accordion.Control>
                  <Box>
                    <Text size="sm" fw={600}>Apariencia de participantes</Text>
                    <Text size="xs" c="dimmed">Nombre y subtítulo en tiles</Text>
                  </Box>
                </Accordion.Control>
                <Accordion.Panel>
                  <TileAppearancePanel eventSlug={eventSlug} disabled={disabled} />
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>

          </Stack>
        </Tabs.Panel>

      </ScrollArea>
    </Tabs>
  );
};
