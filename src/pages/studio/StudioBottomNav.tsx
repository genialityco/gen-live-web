import { Box, ActionIcon, Text, Indicator } from "@mantine/core";
import {
  IconDeviceTv,
  IconUsers,
  IconAdjustments,
  IconSettings,
} from "@tabler/icons-react";

export type MobileTab = "monitor" | "participants" | "controls" | "config";

type TabItem = {
  id: MobileTab;
  icon: React.ReactNode;
  label: string;
  hostOnly?: boolean;
};

const TABS: TabItem[] = [
  { id: "monitor", icon: <IconDeviceTv size={22} />, label: "Monitor" },
  { id: "participants", icon: <IconUsers size={22} />, label: "Participantes" },
  { id: "controls", icon: <IconAdjustments size={22} />, label: "Controles" },
  { id: "config", icon: <IconSettings size={22} />, label: "Configuración", hostOnly: true },
];

type Props = {
  activeTab: MobileTab;
  onChange: (tab: MobileTab) => void;
  isHost: boolean;
  pendingRequests?: number;
};

export function StudioBottomNav({ activeTab, onChange, isHost, pendingRequests = 0 }: Props) {
  const visibleTabs = TABS.filter((t) => !t.hostOnly || isHost);

  return (
    <Box
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 58,
        display: "flex",
        alignItems: "stretch",
        background: "var(--mantine-color-dark-8)",
        borderTop: "1px solid var(--mantine-color-dark-5)",
        zIndex: 200,
      }}
    >
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const showBadge = tab.id === "config" && pendingRequests > 0;

        return (
          <Box
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              cursor: "pointer",
              borderTop: isActive
                ? "2px solid var(--mantine-color-blue-5)"
                : "2px solid transparent",
              background: isActive ? "var(--mantine-color-dark-7)" : "transparent",
              transition: "background 0.15s",
              WebkitTapHighlightColor: "transparent",
              userSelect: "none",
            }}
          >
            <Indicator
              disabled={!showBadge}
              label={pendingRequests > 9 ? "9+" : pendingRequests}
              size={16}
              offset={4}
              processing={showBadge}
            >
              <ActionIcon
                variant="transparent"
                color={isActive ? "blue" : "gray"}
                size="md"
                style={{ pointerEvents: "none" }}
              >
                {tab.icon}
              </ActionIcon>
            </Indicator>
            <Text
              size="xs"
              style={{
                fontSize: 10,
                color: isActive
                  ? "var(--mantine-color-blue-4)"
                  : "var(--mantine-color-gray-5)",
                lineHeight: 1,
              }}
            >
              {tab.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
