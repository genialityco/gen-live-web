import { useState, useEffect, useRef, useCallback } from "react";
import {
  Stack,
  TextInput,
  Textarea,
  Switch,
  Button,
  Group,
  Alert,
  Grid,
  Loader,
  Center,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useDisclosure } from "@mantine/hooks";
import {
  fetchEventTemplates,
  fetchEmailVariables,
  upsertEmailTemplate,
  deleteEmailTemplate,
  type EmailTemplate,
  type AvailableVariable,
} from "../../../api/event-email";
import EmailVariablesPanel from "./EmailVariablesPanel";
import EmailPreviewModal from "./EmailPreviewModal";

interface EmailTemplateEditorProps {
  orgId: string;
  eventId: string;
}

export default function EmailTemplateEditor({
  orgId,
  eventId,
}: EmailTemplateEditorProps) {
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [variables, setVariables] = useState<AvailableVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Default template content for new templates
  const DEFAULT_SUBJECT = "¡Bienvenido/a a {{event.title}}!";
  const DEFAULT_BODY = `<h2>¡Hola!</h2>

<p>Tu registro al evento <strong>{{event.title}}</strong> ha sido confirmado.</p>

<table cellpadding="0" cellspacing="0" style="width: 100%; margin: 16px 0; border-collapse: collapse;">
  <tr>
    <td style="padding: 12px 16px; background-color: #f8f9fa; border-radius: 8px;">
      <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; color: #868e96; font-size: 13px; width: 110px;">Fecha de inicio</td>
          <td style="padding: 4px 0; font-size: 13px;">{{event.schedule.startsAt.date}}, {{event.schedule.startsAt.time}}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #868e96; font-size: 13px;">Fecha de fin</td>
          <td style="padding: 4px 0; font-size: 13px;">{{event.schedule.endsAt.date}}, {{event.schedule.endsAt.time}}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 4px 0; color: #adb5bd; font-size: 11px;">{{event.schedule.startsAt.timezone}}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<p>Puedes acceder al evento desde el siguiente enlace:</p>
<p><a href="{{event.joinUrl}}" style="display: inline-block; padding: 10px 24px; background-color: #4263eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Ir al evento</a></p>

<p>¡Te esperamos!</p>`;

  // Form state
  const [name, setName] = useState("Email de bienvenida");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [enabled, setEnabled] = useState(true);

  // Track which field is focused for variable insertion
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const activeFieldRef = useRef<"subject" | "body">("body");

  const [previewOpened, { open: openPreview, close: closePreview }] =
    useDisclosure(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [templates, vars] = await Promise.all([
        fetchEventTemplates(orgId, eventId),
        fetchEmailVariables(orgId, eventId),
      ]);

      setVariables(vars);

      // Find WELCOME template (event-level or inherited)
      const welcomeTemplate = templates.find((t) => t.type === "WELCOME");
      if (welcomeTemplate) {
        setTemplate(welcomeTemplate);
        setName(welcomeTemplate.name);
        setSubject(welcomeTemplate.subject);
        setBody(welcomeTemplate.body);
        setEnabled(welcomeTemplate.enabled);
      }
    } catch {
      notifications.show({
        title: "Error",
        message: "No se pudieron cargar las plantillas",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  }, [orgId, eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await upsertEmailTemplate({
        orgId,
        eventId,
        type: "WELCOME",
        name,
        subject,
        body,
        enabled,
      });
      setTemplate(result);
      notifications.show({
        title: "Guardado",
        message: "Plantilla guardada correctamente",
        color: "green",
      });
    } catch {
      notifications.show({
        title: "Error",
        message: "No se pudo guardar la plantilla",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCustomize = async () => {
    // Create event-level override from inherited org template
    setSaving(true);
    try {
      const result = await upsertEmailTemplate({
        orgId,
        eventId,
        type: "WELCOME",
        name,
        subject,
        body,
        enabled,
      });
      setTemplate(result);
      notifications.show({
        title: "Personalizado",
        message: "Plantilla personalizada para este evento",
        color: "blue",
      });
    } catch {
      notifications.show({
        title: "Error",
        message: "No se pudo personalizar la plantilla",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRevertToInherited = async () => {
    if (!template?._id || template.isInherited) return;
    setSaving(true);
    try {
      await deleteEmailTemplate(template._id);
      await loadData();
      notifications.show({
        title: "Revertido",
        message: "Usando la plantilla de la organización",
        color: "blue",
      });
    } catch {
      notifications.show({
        title: "Error",
        message: "No se pudo revertir la plantilla",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInsertVariable = (variable: string) => {
    const field = activeFieldRef.current;

    if (field === "subject" && subjectRef.current) {
      const input = subjectRef.current;
      const start = input.selectionStart ?? subject.length;
      const end = input.selectionEnd ?? subject.length;
      const newValue =
        subject.substring(0, start) + variable + subject.substring(end);
      setSubject(newValue);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(
          start + variable.length,
          start + variable.length
        );
      });
    } else if (bodyRef.current) {
      const textarea = bodyRef.current;
      const start = textarea.selectionStart ?? body.length;
      const end = textarea.selectionEnd ?? body.length;
      const newValue =
        body.substring(0, start) + variable + body.substring(end);
      setBody(newValue);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + variable.length,
          start + variable.length
        );
      });
    }
  };

  if (loading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  const isInherited = template?.isInherited === true;
  const hasTemplate = !!template;

  return (
    <>
      <Stack gap="md">
        {isInherited && (
          <Alert color="blue" title="Plantilla heredada">
            Esta plantilla viene de la organización. Los cambios se aplicarán
            solo si personalizas para este evento.
            <Group mt="xs">
              <Button
                size="xs"
                variant="light"
                onClick={handleCustomize}
                loading={saving}
              >
                Personalizar para este evento
              </Button>
            </Group>
          </Alert>
        )}

        {!isInherited && hasTemplate && (
          <Group justify="flex-end">
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={handleRevertToInherited}
              loading={saving}
            >
              Volver a heredar de la organización
            </Button>
          </Group>
        )}

        {!hasTemplate && (
          <Alert color="yellow" title="Sin plantilla">
            No hay plantilla de bienvenida configurada. Crea una para enviar
            emails automáticos al registrarse.
          </Alert>
        )}

        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="sm">
              <Switch
                label="Email habilitado"
                checked={enabled}
                onChange={(e) => setEnabled(e.currentTarget.checked)}
                disabled={isInherited}
              />

              <TextInput
                label="Asunto"
                placeholder="Ej: Bienvenido a {{event.title}}"
                value={subject}
                onChange={(e) => setSubject(e.currentTarget.value)}
                ref={subjectRef}
                onFocus={() => (activeFieldRef.current = "subject")}
                disabled={isInherited}
              />

              <Textarea
                label="Cuerpo del email (HTML)"
                placeholder="Escribe el contenido del email. Usa variables como {{attendee.email}} o {{form.nombre}}"
                value={body}
                onChange={(e) => setBody(e.currentTarget.value)}
                minRows={12}
                autosize
                ref={bodyRef}
                onFocus={() => (activeFieldRef.current = "body")}
                disabled={isInherited}
              />

              <Group>
                <Button
                  onClick={handleSave}
                  loading={saving}
                  disabled={isInherited || !subject || !body}
                >
                  Guardar
                </Button>
                <Button
                  variant="light"
                  onClick={openPreview}
                  disabled={!subject || !body}
                >
                  Vista previa
                </Button>
              </Group>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <EmailVariablesPanel
              variables={variables}
              onInsertVariable={handleInsertVariable}
            />
          </Grid.Col>
        </Grid>
      </Stack>

      <EmailPreviewModal
        opened={previewOpened}
        onClose={closePreview}
        orgId={orgId}
        eventId={eventId}
        templateId={template?._id}
        subject={subject}
        body={body}
      />
    </>
  );
}
