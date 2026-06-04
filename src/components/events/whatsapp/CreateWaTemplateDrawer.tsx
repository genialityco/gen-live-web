import { useState, useMemo } from "react";
import {
  Drawer, Stack, TextInput, Textarea, Select, Switch, Button,
  Group, Text, Title, Paper, Box, Divider, ActionIcon, ScrollArea,
} from "@mantine/core";
import { IconPlus, IconTrash, IconBrandWhatsapp } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { createWaTemplate, type WaTemplateComponent } from "../../../api/wa-campaign";
import { type FormField } from "../../../types";

// ─── Constants ────────────────────────────────────────────────────────────────

const FIXED_SOURCES = [
  { value: "attendee.name", label: "Nombre del asistente" },
  { value: "attendee.email", label: "Correo del asistente" },
  { value: "event.title", label: "Título del evento" },
  { value: "event.startDate", label: "Fecha del evento" },
  { value: "event.slug", label: "Slug del evento" },
  { value: "org.slug", label: "Slug de la organización" },
  { value: "_tracking_url", label: "URL de seguimiento (tracking)" },
];

const FIXED_exampleValues: Record<string, string> = {
  "attendee.name": "María García",
  "attendee.email": "maria@email.com",
  "event.title": "Mi Evento 2026",
  "event.startDate": "15 jun 2026, 10:00",
  "event.slug": "mi-evento",
  "org.slug": "mi-organizacion",
  "_tracking_url": "org/mi-org/event/mi-evento/attend",
};

// Tipos de campo que no aportan valor como variable de mensaje
const EXCLUDED_FIELD_TYPES = new Set(["checkbox"]);

function buildFormSources(fields: FormField[]): { value: string; label: string }[] {
  return fields
    .filter((f) => !EXCLUDED_FIELD_TYPES.has(f.type) && !f.autoCalculated && f.id !== "email_system")
    .map((f) => ({ value: `form.${f.id}`, label: f.label }));
}

const LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "en_US", label: "Inglés (US)" },
  { value: "pt_BR", label: "Portugués (BR)" },
];

const CATEGORIES = [
  { value: "MARKETING", label: "Marketing" },
  { value: "UTILITY", label: "Utilidad" },
  { value: "AUTHENTICATION", label: "Autenticación" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toSlug = (str: string) =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

function renderPreviewText(text: string): React.ReactNode[] {
  return text.split(/(\*[^*\n]+\*)/).map((part, i) =>
    part.startsWith("*") && part.endsWith("*") && part.length > 2
      ? <strong key={i}>{part.slice(1, -1)}</strong>
      : part,
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type BtnType = "URL" | "QUICK_REPLY" | "PHONE_NUMBER";

interface ButtonDraft {
  type: BtnType;
  text: string;
  url: string;
  phone_number: string;
}

interface Props {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
  registrationFields?: FormField[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CreateWaTemplateDrawer({ opened, onClose, onCreated, registrationFields = [] }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("MARKETING");
  const [language, setLanguage] = useState("es");
  const [headerEnabled, setHeaderEnabled] = useState(false);
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerEnabled, setFooterEnabled] = useState(false);
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState<ButtonDraft[]>([]);
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // ── handlers ────────────────────────────────────────────────────────────────

  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    setName(toSlug(val));
  };

  const addButton = () => {
    if (buttons.length >= 3) return;
    setButtons((prev) => [...prev, { type: "URL", text: "", url: "", phone_number: "" }]);
  };

  const removeButton = (i: number) => setButtons((prev) => prev.filter((_, idx) => idx !== i));

  const updateButton = (i: number, field: keyof ButtonDraft, val: string) =>
    setButtons((prev) => prev.map((b, idx) => (idx === i ? { ...b, [field]: val } : b)));

  const insertVar = (n: number) => setBodyText((prev) => prev + `{{${n}}}`);

  const setMapping = (key: string, value: string | null) =>
    setVariableMappings((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });

  // ── sources dinámicas: fijas + campos del formulario ────────────────────────

  const varSources = useMemo(() => {
    const formSources = buildFormSources(registrationFields);
    if (formSources.length === 0) return FIXED_SOURCES;
    return [
      { value: "__group_fixed__", label: "── Datos del evento / asistente ──", disabled: true },
      ...FIXED_SOURCES,
      { value: "__group_form__", label: "── Campos del formulario de registro ──", disabled: true },
      ...formSources,
    ];
  }, [registrationFields]);

  const exampleValues = useMemo<Record<string, string>>(() => {
    const formExamples: Record<string, string> = {};
    for (const f of registrationFields) {
      if (!EXCLUDED_FIELD_TYPES.has(f.type) && !f.autoCalculated && f.id !== "email_system") {
        formExamples[`form.${f.id}`] = f.placeholder ?? f.label;
      }
    }
    return { ...FIXED_exampleValues, ...formExamples };
  }, [registrationFields]);

  // ── derived state ────────────────────────────────────────────────────────────

  const detectedVars = useMemo(() => {
    const vars: { key: string; label: string }[] = [];
    const seen = new Set<string>();

    const push = (key: string, label: string) => {
      if (!seen.has(key)) { seen.add(key); vars.push({ key, label }); }
    };

    for (const m of bodyText.matchAll(/\{\{(\d+)\}\}/g))
      push(`body.${m[1]}`, `Cuerpo {{${m[1]}}}`);

    if (headerEnabled)
      for (const m of headerText.matchAll(/\{\{(\d+)\}\}/g))
        push(`header.${m[1]}`, `Encabezado {{${m[1]}}}`);

    buttons.forEach((btn, i) => {
      if (btn.type === "URL" && /\{\{1\}\}/.test(btn.url))
        push(`button.${i}.1`, `Botón "${btn.text || i + 1}" — URL dinámica`);
    });

    return vars;
  }, [bodyText, headerEnabled, headerText, buttons]);

  const preview = useMemo(() => {
    const replace = (text: string, prefix: string) =>
      text.replace(/\{\{(\d+)\}\}/g, (_, n) => {
        const src = variableMappings[`${prefix}.${n}`];
        return src ? (exampleValues[src] ?? `{{${n}}}`) : `{{${n}}}`;
      });
    return {
      header: headerEnabled ? replace(headerText, "header") : "",
      body: replace(bodyText, "body"),
      footer: footerEnabled ? footerText : "",
    };
  }, [bodyText, headerEnabled, headerText, footerEnabled, footerText, variableMappings, exampleValues]);

  // ── build payload ────────────────────────────────────────────────────────────

  const buildComponents = (): WaTemplateComponent[] => {
    const comps: WaTemplateComponent[] = [];

    if (headerEnabled && headerText.trim()) {
      const comp: WaTemplateComponent = { type: "HEADER", format: "TEXT", text: headerText.trim() };
      if (/\{\{\d+\}\}/.test(headerText)) {
        comp.example = {
          header_text: [
            headerText.replace(/\{\{(\d+)\}\}/g, (_, n) =>
              exampleValues[variableMappings[`header.${n}`]] ?? `Ejemplo ${n}`,
            ),
          ],
        };
      }
      comps.push(comp);
    }

    if (bodyText.trim()) {
      const comp: WaTemplateComponent = { type: "BODY", text: bodyText.trim() };
      const varNums = [
        ...new Set([...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => parseInt(m[1]))),
      ].sort((a, b) => a - b);
      if (varNums.length > 0) {
        comp.example = {
          body_text: [
            varNums.map((n) => exampleValues[variableMappings[`body.${n}`]] ?? `Ejemplo ${n}`),
          ],
        };
      }
      comps.push(comp);
    }

    if (footerEnabled && footerText.trim())
      comps.push({ type: "FOOTER", text: footerText.trim() });

    if (buttons.length > 0) {
      comps.push({
        type: "BUTTONS",
        buttons: buttons.map((btn, i) => {
          const b: any = { type: btn.type, text: btn.text };
          if (btn.type === "URL") {
            b.url = btn.url;
            if (/\{\{1\}\}/.test(btn.url)) {
              const src = variableMappings[`button.${i}.1`];
              b.example = [exampleValues[src] ?? "org/ejemplo/event/ejemplo/attend"];
            }
          }
          if (btn.type === "PHONE_NUMBER") b.phone_number = btn.phone_number;
          return b;
        }),
      });
    }

    return comps;
  };

  // ── submit ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!displayName.trim() || !name.trim() || !bodyText.trim()) {
      notifications.show({
        title: "Campos requeridos",
        message: "Nombre, identificador y cuerpo son obligatorios",
        color: "orange",
      });
      return;
    }

    setSaving(true);
    try {
      await createWaTemplate({
        name: name.trim(),
        displayName: displayName.trim(),
        category,
        language,
        components: buildComponents(),
        variableMappings,
      });
      notifications.show({
        title: "Template creado",
        message: "Guardado como borrador. Ahora puedes enviarlo a revisión en Meta.",
        color: "green",
      });
      onCreated();
      resetForm();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err?.response?.data?.message ?? "No se pudo crear el template",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setDisplayName(""); setName(""); setCategory("MARKETING"); setLanguage("es");
    setHeaderEnabled(false); setHeaderText("");
    setBodyText("");
    setFooterEnabled(false); setFooterText("");
    setButtons([]); setVariableMappings({});
  };

  const handleClose = () => { resetForm(); onClose(); };

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconBrandWhatsapp size={18} color="#25D366" />
          <Text fw={600}>Nuevo template de WhatsApp</Text>
        </Group>
      }
      position="right"
      size="xl"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="lg" pb="xl">

        {/* ── Información básica ─────────────────────────────────────────── */}
        <Stack gap="sm">
          <Title order={6} c="dimmed">INFORMACIÓN BÁSICA</Title>
          <TextInput
            label="Nombre para mostrar"
            placeholder="Invitación a webinar"
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Identificador en Meta"
            description="Solo minúsculas, números y guiones bajos. Debe ser único en tu WABA."
            placeholder="invitacion_webinar"
            value={name}
            onChange={(e) => setName(e.currentTarget.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            styles={{ input: { fontFamily: "monospace" } }}
            required
          />
          <Group grow>
            <Select
              label="Categoría"
              data={CATEGORIES}
              value={category}
              onChange={(v) => v && setCategory(v as typeof category)}
            />
            <Select
              label="Idioma"
              data={LANGUAGES}
              value={language}
              onChange={(v) => setLanguage(v ?? "es")}
            />
          </Group>
        </Stack>

        <Divider />

        {/* ── Encabezado ────────────────────────────────────────────────── */}
        <Stack gap="sm">
          <Group justify="space-between">
            <Stack gap={2}>
              <Title order={6} c="dimmed">ENCABEZADO</Title>
              <Text size="xs" c="dimmed">Texto en negrita sobre el cuerpo. Opcional.</Text>
            </Stack>
            <Switch
              size="sm"
              label="Incluir"
              checked={headerEnabled}
              onChange={(e) => setHeaderEnabled(e.currentTarget.checked)}
            />
          </Group>
          {headerEnabled && (
            <TextInput
              placeholder="Ej: ¡Hola {{1}}!"
              value={headerText}
              onChange={(e) => setHeaderText(e.currentTarget.value)}
              description="Puedes usar {{1}} para una variable dinámica"
            />
          )}
        </Stack>

        <Divider />

        {/* ── Cuerpo ────────────────────────────────────────────────────── */}
        <Stack gap="sm">
          <Title order={6} c="dimmed">CUERPO DEL MENSAJE *</Title>
          <Textarea
            placeholder={"Hola {{1}}, te invitamos a *{{2}}* 🎓\n\nFecha: {{3}}\n\n¡No te lo pierdas!"}
            value={bodyText}
            onChange={(e) => setBodyText(e.currentTarget.value)}
            minRows={4}
            autosize
            required
          />
          <Group gap="xs" align="center">
            <Text size="xs" c="dimmed">Insertar:</Text>
            {[1, 2, 3, 4].map((n) => (
              <Button key={n} size="xs" variant="default" onClick={() => insertVar(n)}>
                {`{{${n}}}`}
              </Button>
            ))}
          </Group>
          <Text size="xs" c="dimmed">
            Usa *texto* para negrita. Las variables {"{{N}}"} se reemplazan al enviar la campaña.
          </Text>
        </Stack>

        <Divider />

        {/* ── Pie de página ─────────────────────────────────────────────── */}
        <Stack gap="sm">
          <Group justify="space-between">
            <Stack gap={2}>
              <Title order={6} c="dimmed">PIE DE PÁGINA</Title>
              <Text size="xs" c="dimmed">Texto gris bajo el cuerpo. Opcional.</Text>
            </Stack>
            <Switch
              size="sm"
              label="Incluir"
              checked={footerEnabled}
              onChange={(e) => setFooterEnabled(e.currentTarget.checked)}
            />
          </Group>
          {footerEnabled && (
            <TextInput
              placeholder="Ej: No responder a este mensaje"
              value={footerText}
              onChange={(e) => setFooterText(e.currentTarget.value)}
            />
          )}
        </Stack>

        <Divider />

        {/* ── Botones ───────────────────────────────────────────────────── */}
        <Stack gap="sm">
          <Group justify="space-between">
            <Stack gap={2}>
              <Title order={6} c="dimmed">BOTONES</Title>
              <Text size="xs" c="dimmed">Máximo 3. Aparecen bajo el mensaje.</Text>
            </Stack>
            {buttons.length < 3 && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={12} />}
                onClick={addButton}
              >
                Agregar botón
              </Button>
            )}
          </Group>

          {buttons.length === 0 && (
            <Text size="sm" c="dimmed">Sin botones.</Text>
          )}

          {buttons.map((btn, i) => (
            <Paper key={i} withBorder p="sm" radius="sm">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Botón {i + 1}</Text>
                  <ActionIcon size="sm" color="red" variant="subtle" onClick={() => removeButton(i)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
                <Group grow>
                  <Select
                    size="sm"
                    label="Tipo"
                    data={[
                      { value: "URL", label: "Enlace URL" },
                      { value: "QUICK_REPLY", label: "Respuesta rápida" },
                      { value: "PHONE_NUMBER", label: "Llamar teléfono" },
                    ]}
                    value={btn.type}
                    onChange={(v) => v && updateButton(i, "type", v)}
                  />
                  <TextInput
                    size="sm"
                    label="Texto del botón"
                    placeholder="Ver evento"
                    value={btn.text}
                    onChange={(e) => updateButton(i, "text", e.currentTarget.value)}
                  />
                </Group>
                {btn.type === "URL" && (
                  <TextInput
                    size="sm"
                    label="URL"
                    placeholder="https://dominio.com/{{1}}"
                    description="Añade {{1}} al final para URL dinámica por asistente (tracking)"
                    value={btn.url}
                    onChange={(e) => updateButton(i, "url", e.currentTarget.value)}
                  />
                )}
                {btn.type === "PHONE_NUMBER" && (
                  <TextInput
                    size="sm"
                    label="Número de teléfono"
                    placeholder="+521234567890"
                    value={btn.phone_number}
                    onChange={(e) => updateButton(i, "phone_number", e.currentTarget.value)}
                  />
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>

        {/* ── Mapeo de variables ────────────────────────────────────────── */}
        {detectedVars.length > 0 && (
          <>
            <Divider />
            <Stack gap="sm">
              <Stack gap={2}>
                <Title order={6} c="dimmed">MAPEO DE VARIABLES</Title>
                <Text size="xs" c="dimmed">
                  Indica qué dato de la campaña reemplaza cada variable detectada.
                </Text>
              </Stack>
              {detectedVars.map(({ key, label }) => (
                <Select
                  key={key}
                  label={label}
                  placeholder="Seleccionar fuente de datos..."
                  data={varSources}
                  value={variableMappings[key] ?? null}
                  onChange={(v) => setMapping(key, v)}
                  clearable
                />
              ))}
            </Stack>
          </>
        )}

        {/* ── Vista previa ──────────────────────────────────────────────── */}
        {bodyText.trim() && (
          <>
            <Divider />
            <Stack gap="sm">
              <Title order={6} c="dimmed">VISTA PREVIA</Title>
              <Box
                style={{
                  background: "#e5ddd5",
                  borderRadius: 8,
                  padding: 16,
                  minHeight: 80,
                }}
              >
                <Box
                  style={{
                    background: "#fff",
                    borderRadius: "0 8px 8px 8px",
                    padding: "10px 12px",
                    maxWidth: 300,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                  }}
                >
                  {preview.header && (
                    <Text fw={700} size="sm" mb={4}>{preview.header}</Text>
                  )}
                  <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {renderPreviewText(preview.body)}
                  </Text>
                  {preview.footer && (
                    <Text size="xs" c="dimmed" mt={4}>{preview.footer}</Text>
                  )}
                  {buttons.length > 0 && (
                    <>
                      <Divider my={8} />
                      <Stack gap={2}>
                        {buttons.map((btn, i) => (
                          <Text
                            key={i}
                            size="xs"
                            ta="center"
                            c="blue"
                            fw={500}
                            py={2}
                            style={{ borderTop: i > 0 ? "1px solid #f0f0f0" : undefined }}
                          >
                            {btn.text || `Botón ${i + 1}`}
                          </Text>
                        ))}
                      </Stack>
                    </>
                  )}
                  <Text size="xs" c="dimmed" ta="right" mt={6}>
                    {new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </Box>
              </Box>
              <Text size="xs" c="dimmed">
                Las variables sin mapear se muestran como {"{{N}}"}. Los valores son ejemplos.
              </Text>
            </Stack>
          </>
        )}

        {/* ── Acciones ──────────────────────────────────────────────────── */}
        <Group justify="flex-end" pt="sm">
          <Button variant="subtle" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            leftSection={<IconBrandWhatsapp size={16} />}
            loading={saving}
            onClick={handleSave}
            disabled={!displayName.trim() || !name.trim() || !bodyText.trim()}
            color="green"
          >
            Guardar como borrador
          </Button>
        </Group>

      </Stack>
    </Drawer>
  );
}
