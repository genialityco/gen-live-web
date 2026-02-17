import { useState } from "react";
import {
  Card,
  Stack,
  Text,
  Button,
  Group,
  Collapse,
  UnstyledButton,
  Badge,
  ScrollArea,
} from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import type { AvailableVariable } from "../../../api/event-email";

interface EmailVariablesPanelProps {
  variables: AvailableVariable[];
  onInsertVariable: (variable: string) => void;
}

export default function EmailVariablesPanel({
  variables,
  onInsertVariable,
}: EmailVariablesPanelProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Evento: true,
    Organización: true,
    Asistente: true,
    Formulario: true,
  });

  // Group variables by section
  const sections = variables.reduce<Record<string, AvailableVariable[]>>(
    (acc, v) => {
      if (!acc[v.section]) acc[v.section] = [];
      acc[v.section].push(v);
      return acc;
    },
    {}
  );

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const sectionOrder = ["Evento", "Organización", "Asistente", "Formulario"];

  return (
    <Card withBorder radius="md" p="sm">
      <Text fw={600} size="sm" mb="xs">
        Variables disponibles
      </Text>
      <ScrollArea.Autosize mah={500}>
        <Stack gap={4}>
          {sectionOrder.map((section) => {
            const items = sections[section];
            if (!items?.length) return null;

            return (
              <div key={section}>
                <UnstyledButton
                  onClick={() => toggleSection(section)}
                  w="100%"
                  py={4}
                >
                  <Group gap={4}>
                    {openSections[section] ? (
                      <IconChevronDown size={14} />
                    ) : (
                      <IconChevronRight size={14} />
                    )}
                    <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                      {section}
                    </Text>
                    <Badge size="xs" variant="light" color="gray">
                      {items.length}
                    </Badge>
                  </Group>
                </UnstyledButton>

                <Collapse in={openSections[section] ?? false}>
                  <Stack gap={2} pl="md">
                    {items.map((v) => (
                      <div key={v.key}>
                        <Group gap={4} wrap="nowrap">
                          <Text size="xs" c="dimmed" style={{ flex: 1 }} truncate>
                            {v.label}
                          </Text>
                          <Button
                            size="compact-xs"
                            variant="light"
                            onClick={() =>
                              onInsertVariable(`{{${v.key}}}`)
                            }
                          >
                            {`{{${v.key.split(".").pop()}}}`}
                          </Button>
                        </Group>
                        {v.hasDisplayVariant && (
                          <Group gap={4} pl="sm" mt={2}>
                            <Button
                              size="compact-xs"
                              variant="subtle"
                              color="teal"
                              onClick={() => {
                                const displayKey = v.key.replace(
                                  "form.",
                                  "formDisplay."
                                );
                                onInsertVariable(`{{${displayKey}}}`);
                              }}
                            >
                              Display
                            </Button>
                          </Group>
                        )}
                      </div>
                    ))}
                  </Stack>
                </Collapse>
              </div>
            );
          })}
        </Stack>
      </ScrollArea.Autosize>
    </Card>
  );
}
