import { useState, useEffect, useRef, useCallback } from "react";
import {
  Modal,
  Stack,
  Text,
  TextInput,
  Button,
  Group,
  Loader,
  Center,
  Alert,
  Badge,
  Paper,
  ActionIcon,
  Box,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconSearch, IconX, IconUser } from "@tabler/icons-react";
import {
  previewTemplate,
  sendTestEmail as sendTestEmailApi,
} from "../../../api/event-email";
import { searchOrgAttendees, type OrgAttendee } from "../../../api/org-attendees";

interface EmailPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  orgId: string;
  eventId: string;
  templateId?: string;
  subject: string;
  body: string;
}

export default function EmailPreviewModal({
  opened,
  onClose,
  orgId,
  eventId,
  templateId,
  subject,
  body,
}: EmailPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{
    renderedSubject: string;
    renderedBody: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Attendee sample selector state
  const [attendeeQuery, setAttendeeQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<OrgAttendee[]>([]);
  const [selectedAttendee, setSelectedAttendee] = useState<OrgAttendee | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const loadPreview = useCallback(async (sampleAttendeeId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await previewTemplate({
        orgId,
        eventId,
        subject,
        body,
        sampleAttendeeId,
      });
      setPreview(result);
    } catch {
      setError("Error al generar la vista previa");
    } finally {
      setLoading(false);
    }
  }, [orgId, eventId, subject, body]);

  const handleSearchAttendee = async () => {
    if (!attendeeQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const results = await searchOrgAttendees(orgId, attendeeQuery.trim());
      if (results.length === 0) {
        setSearchError("No se encontraron asistentes con ese criterio");
      } else {
        setSearchResults(results.slice(0, 5));
      }
    } catch {
      setSearchError("Error al buscar asistentes");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectAttendee = (attendee: OrgAttendee) => {
    setSelectedAttendee(attendee);
    setSearchResults([]);
    setAttendeeQuery("");
    loadPreview(attendee._id);
  };

  const handleClearAttendee = () => {
    setSelectedAttendee(null);
    loadPreview(undefined);
  };

  const handleSendTest = async () => {
    if (!testEmail) return;
    setSendingTest(true);
    try {
      await sendTestEmailApi(orgId, eventId, {
        templateId,
        subject,
        body,
        to: testEmail,
        sampleAttendeeId: selectedAttendee?._id,
      });
      notifications.show({
        title: "Email enviado",
        message: `Email de prueba enviado a ${testEmail}`,
        color: "green",
      });
    } catch {
      notifications.show({
        title: "Error",
        message: "No se pudo enviar el email de prueba",
        color: "red",
      });
    } finally {
      setSendingTest(false);
    }
  };

  // Auto-resize iframe to fit content
  const resizeIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;
    const height = iframe.contentDocument.body.scrollHeight;
    iframe.style.height = `${Math.min(Math.max(height + 20, 200), 600)}px`;
  }, []);

  // Load preview each time modal opens (always fresh)
  useEffect(() => {
    if (opened) {
      setPreview(null);
      setSelectedAttendee(null);
      setAttendeeQuery("");
      setSearchResults([]);
      setSearchError(null);
      loadPreview(undefined);
    }
  }, [opened]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Vista previa del email"
      size="xl"
      centered
    >
      <Stack gap="md">
        {/* Attendee selector */}
        <Paper p="sm" radius="sm" withBorder>
          <Text size="xs" fw={600} c="dimmed" mb={8}>
            Datos de muestra
          </Text>

          {selectedAttendee ? (
            <Group gap="xs">
              <IconUser size={14} />
              <Text size="sm" fw={500} style={{ flex: 1 }}>
                {selectedAttendee.email}
                {selectedAttendee.name ? ` — ${selectedAttendee.name}` : ""}
              </Text>
              <Badge size="xs" color="teal" variant="light">Real</Badge>
              <ActionIcon size="xs" variant="subtle" color="gray" onClick={handleClearAttendee}>
                <IconX size={12} />
              </ActionIcon>
            </Group>
          ) : (
            <>
              <Group gap="xs" align="flex-end">
                <TextInput
                  placeholder="Buscar asistente por email o nombre..."
                  value={attendeeQuery}
                  onChange={(e) => {
                    setAttendeeQuery(e.currentTarget.value);
                    setSearchError(null);
                    setSearchResults([]);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchAttendee()}
                  size="xs"
                  style={{ flex: 1 }}
                  rightSection={searching ? <Loader size={12} /> : undefined}
                />
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconSearch size={12} />}
                  onClick={handleSearchAttendee}
                  loading={searching}
                  disabled={!attendeeQuery.trim()}
                >
                  Buscar
                </Button>
              </Group>
              {!selectedAttendee && !searchResults.length && !searchError && (
                <Text size="xs" c="dimmed" mt={4}>
                  Sin asistente seleccionado — se usan datos de ejemplo genéricos
                </Text>
              )}
            </>
          )}

          {searchError && (
            <Text size="xs" c="red" mt={4}>{searchError}</Text>
          )}

          {searchResults.length > 0 && (
            <Box mt={6} style={{ border: "1px solid #dee2e6", borderRadius: 6, overflow: "hidden" }}>
              {searchResults.map((a) => (
                <Box
                  key={a._id}
                  px="sm"
                  py={6}
                  style={{ cursor: "pointer", borderBottom: "1px solid #f1f3f5" }}
                  onClick={() => handleSelectAttendee(a)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <Text size="xs" fw={500}>{a.email}</Text>
                  {a.name && <Text size="xs" c="dimmed">{a.name}</Text>}
                </Box>
              ))}
            </Box>
          )}
        </Paper>

        {loading && (
          <Center py="xl">
            <Loader />
          </Center>
        )}

        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        {preview && !loading && (
          <>
            {/* Subject preview — styled like an email client */}
            <Paper p="sm" radius="sm" withBorder>
              <Group gap="xs">
                <Badge size="xs" variant="light" color="gray">
                  Asunto
                </Badge>
                <Text size="sm" fw={600}>
                  {preview.renderedSubject}
                </Text>
              </Group>
            </Paper>

            {/* Email body — full wrapper preview */}
            <div
              style={{
                border: "1px solid #dee2e6",
                borderRadius: 8,
                overflow: "hidden",
                backgroundColor: "#f5f5f7",
              }}
            >
              <iframe
                ref={iframeRef}
                sandbox="allow-same-origin"
                srcDoc={preview.renderedBody}
                onLoad={resizeIframe}
                style={{
                  width: "100%",
                  height: 400,
                  border: "none",
                  display: "block",
                }}
                title="Email preview"
              />
            </div>

            {/* Test email section */}
            <Paper p="sm" radius="sm" withBorder>
              <Text size="xs" fw={600} c="dimmed" mb={8}>
                Enviar correo de prueba
                {selectedAttendee && (
                  <Text span c="teal" ml={4}>(con datos de {selectedAttendee.email})</Text>
                )}
              </Text>
              <Group>
                <TextInput
                  placeholder="correo@ejemplo.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.currentTarget.value)}
                  style={{ flex: 1 }}
                  size="sm"
                />
                <Button
                  size="sm"
                  onClick={handleSendTest}
                  loading={sendingTest}
                  disabled={!testEmail}
                >
                  Enviar prueba
                </Button>
              </Group>
            </Paper>
          </>
        )}
      </Stack>
    </Modal>
  );
}
