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
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  previewTemplate,
  sendTestEmail as sendTestEmailApi,
} from "../../../api/event-email";

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

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await previewTemplate({
        orgId,
        eventId,
        subject,
        body,
      });
      setPreview(result);
    } catch {
      setError("Error al generar la vista previa");
    } finally {
      setLoading(false);
    }
  }, [orgId, eventId, subject, body]);

  const handleSendTest = async () => {
    if (!testEmail) return;
    setSendingTest(true);
    try {
      await sendTestEmailApi(orgId, eventId, {
        templateId,
        subject,
        body,
        to: testEmail,
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
      loadPreview();
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
