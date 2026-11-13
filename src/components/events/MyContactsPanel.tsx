// src/components/events/MyContactsPanel.tsx
import { useState, type ReactNode } from "react";
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Menu,
  Modal,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  blockContact,
  contactVCard,
  deleteContactCard,
  dismissContact,
  saveContactCard,
  shareContact,
  unshareContact,
  type ContactPair,
  type MyContacts,
} from "../../api/contacts";
import { trackEvent } from "../../lib/utmTracking";
import { readableOn } from "../../utils/color-contrast";

const FALLBACK_COLOR = "#228BE6";

const apiMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** Etiqueta de la pestaña con los pendientes por responder */
export function MyContactsTabLabel({ pending }: { pending: number }) {
  return (
    <Group gap={6} wrap="nowrap" justify="center">
      <span>🤝 Contactos</span>
      {pending > 0 && (
        <Badge size="xs" color="red" variant="filled" circle>
          {pending}
        </Badge>
      )}
    </Group>
  );
}

type Scope = "event" | "org";

/**
 * «🤝 Contactos»: colegas con quienes se saludó (saludo + devolución). Cada
 * uno decide compartir su tarjeta y los datos se ven solo si ambos aceptaron.
 */
export function MyContactsPanel({
  eventId,
  data,
  refresh,
  color,
  height,
}: {
  eventId: string;
  data: MyContacts;
  refresh: () => Promise<void>;
  color?: string;
  height: number | string;
}) {
  const accent = color || FALLBACK_COLOR;
  const fg = readableOn(accent);
  const [scope, setScope] = useState<Scope>("event");
  const [cardOpen, setCardOpen] = useState(false);
  // Al crear la tarjeta desde «Compartir», se comparte con ese par al guardar
  const [shareAfterCard, setShareAfterCard] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const inScope = data.pairs.filter((p) => (scope === "event" ? p.inEvent : true));
  const pending = inScope.filter((p) => p.status === "pending" && !p.dismissed);
  const hidden = inScope.filter((p) => p.status === "pending" && p.dismissed);
  const waiting = inScope.filter((p) => p.status === "waiting");
  const mutual = inScope.filter((p) => p.status === "mutual");
  const eventCount = data.pairs.filter((p) => p.inEvent).length;

  const run = async (pairId: string, fn: () => Promise<void>, ok?: string) => {
    setBusy(pairId);
    try {
      await fn();
      if (ok) notifications.show({ message: ok, color: "green" });
      await refresh();
    } catch (err) {
      notifications.show({ message: apiMessage(err, "No se pudo completar la acción"), color: "red" });
    } finally {
      setBusy(null);
    }
  };

  const share = (p: ContactPair) => {
    if (!data.card) {
      setShareAfterCard(p.id);
      setCardOpen(true);
      return;
    }
    trackEvent("contact_share", { event_id: eventId, mutual: p.theyAccepted });
    void run(
      p.id,
      () => shareContact(eventId, p.id),
      p.theyAccepted ? `¡Ya tienes el contacto de ${p.name}!` : `Listo: ${p.name} verá tu contacto cuando acepte`,
    );
  };

  return (
    <Box style={{ height, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Encabezado: tu tarjeta */}
      <Box
        p="sm"
        style={{
          flexShrink: 0,
          margin: 8,
          borderRadius: 14,
          background: accent,
          color: fg,
        }}
      >
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text fw={800} size="md" c={fg} lh={1.2}>
              Tus colegas
            </Text>
            <Text size="xs" c={fg} style={{ opacity: 0.9 }} lh={1.35}>
              {data.card
                ? `Compartes: ${[data.card.email && "correo", data.card.whatsapp && "WhatsApp"].filter(Boolean).join(" y ")}`
                : "Intercambia tu contacto con los colegas que saludaste."}
            </Text>
          </Stack>
          <Button
            size="compact-xs"
            variant="white"
            color="dark"
            onClick={() => {
              setShareAfterCard(null);
              setCardOpen(true);
            }}
            style={{ flexShrink: 0 }}
          >
            {data.card ? "Mi tarjeta" : "Crear mi tarjeta"}
          </Button>
        </Group>
      </Box>

      <Box px={8} pb={6} style={{ flexShrink: 0 }}>
        <SegmentedControl
          size="xs"
          fullWidth
          radius="xl"
          value={scope}
          onChange={(v) => setScope(v as Scope)}
          data={[
            { value: "event", label: `Este evento (${eventCount})` },
            { value: "org", label: `Todos (${data.pairs.length})` },
          ]}
        />
      </Box>

      <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto" offsetScrollbars>
        <Stack gap={10} px={8} pb={10}>
          {inScope.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="lg" px="md">
              {scope === "event"
                ? "Cuando devuelvas el saludo de un colega, o alguien devuelva el tuyo, podrán intercambiar contacto aquí."
                : "Aún no tienes colegas en esta organización."}
            </Text>
          )}

          {pending.length > 0 && (
            <Section title="Se saludaron · ¿compartes tu contacto?">
              {pending.map((p) => (
                <PairRow key={p.id} p={p} accent={accent}>
                  {p.theyAccepted && (
                    <Text size="xs" c="teal.8" fw={600}>
                      ✓ Ya compartió su contacto contigo
                    </Text>
                  )}
                  <Group gap={6} mt={4}>
                    <Button
                      size="compact-xs"
                      loading={busy === p.id}
                      onClick={() => share(p)}
                      style={{ background: accent, color: fg }}
                    >
                      Compartir mi contacto
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="gray"
                      disabled={busy === p.id}
                      onClick={() => void run(p.id, () => dismissContact(eventId, p.id))}
                    >
                      Ahora no
                    </Button>
                  </Group>
                </PairRow>
              ))}
            </Section>
          )}

          {mutual.length > 0 && (
            <Section title={`Contactos (${mutual.length})`}>
              {mutual.map((p) => (
                <PairRow
                  key={p.id}
                  p={p}
                  accent={accent}
                  menu={
                    <PairMenu
                      onUnshare={() =>
                        void run(p.id, () => unshareContact(eventId, p.id), "Dejaste de compartir tu contacto")
                      }
                      onBlock={() => void run(p.id, () => blockContact(eventId, p.id), "Contacto bloqueado")}
                    />
                  }
                >
                  <ContactLinks p={p} eventId={eventId} />
                </PairRow>
              ))}
            </Section>
          )}

          {waiting.length > 0 && (
            <Section title="Esperando respuesta">
              {waiting.map((p) => (
                <PairRow
                  key={p.id}
                  p={p}
                  accent={accent}
                  menu={
                    <PairMenu
                      onUnshare={() =>
                        void run(p.id, () => unshareContact(eventId, p.id), "Dejaste de compartir tu contacto")
                      }
                      onBlock={() => void run(p.id, () => blockContact(eventId, p.id), "Contacto bloqueado")}
                    />
                  }
                >
                  <Text size="xs" c="dimmed">
                    ⏳ Compartiste tu contacto. Verás el de {p.name} cuando acepte.
                  </Text>
                </PairRow>
              ))}
            </Section>
          )}

          {hidden.length > 0 && (
            <Anchor size="xs" c="dimmed" ta="center" onClick={() => setShowHidden((s) => !s)}>
              {showHidden ? "Ocultar" : `Ver ocultos (${hidden.length})`}
            </Anchor>
          )}
          {showHidden &&
            hidden.map((p) => (
              <PairRow key={p.id} p={p} accent={accent}>
                <Group gap={6} mt={4}>
                  <Button size="compact-xs" variant="light" loading={busy === p.id} onClick={() => share(p)}>
                    Compartir mi contacto
                  </Button>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color="red"
                    disabled={busy === p.id}
                    onClick={() => void run(p.id, () => blockContact(eventId, p.id), "Contacto bloqueado")}
                  >
                    Bloquear
                  </Button>
                </Group>
              </PairRow>
            ))}
        </Stack>
      </ScrollArea>

      <Modal opened={cardOpen} onClose={() => setCardOpen(false)} title="Mi tarjeta de contacto" centered>
        {cardOpen && (
          <CardEditor
            eventId={eventId}
            data={data}
            accent={accent}
            onDone={async () => {
              setCardOpen(false);
              const pairId = shareAfterCard;
              setShareAfterCard(null);
              if (pairId) {
                await run(pairId, () => shareContact(eventId, pairId), "Tarjeta creada y contacto compartido");
              } else {
                await refresh();
              }
            }}
          />
        )}
      </Modal>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={6}>
      <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: 0.4 }}>
        {title}
      </Text>
      {children}
    </Stack>
  );
}

function PairRow({
  p,
  accent,
  menu,
  children,
}: {
  p: ContactPair;
  accent: string;
  menu?: ReactNode;
  children?: ReactNode;
}) {
  const initial = p.name.replace(/^Dr\(a\)\.\s*/, "").charAt(0).toUpperCase() || "?";
  const mutual = p.status === "mutual";
  return (
    <Box
      p={10}
      style={{
        borderRadius: 12,
        border: `1px solid ${mutual ? `color-mix(in srgb, ${accent} 45%, transparent)` : "var(--mantine-color-gray-3)"}`,
        background: mutual ? `color-mix(in srgb, ${accent} 7%, white)` : "white",
      }}
    >
      <Group gap={10} wrap="nowrap" align="flex-start">
        <Box
          style={{
            width: 38,
            height: 38,
            flexShrink: 0,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            background: mutual ? accent : "var(--mantine-color-gray-2)",
            color: mutual ? readableOn(accent) : "var(--mantine-color-gray-7)",
          }}
        >
          {initial}
        </Box>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" gap={4} wrap="nowrap">
            <Text fw={700} size="sm" c="dark.8" truncate>
              {p.name || "Colega"}
            </Text>
            {menu}
          </Group>
          {p.groupLabel && (
            <Text size="xs" c="dimmed" truncate>
              {p.groupLabel}
            </Text>
          )}
          {children}
        </Stack>
      </Group>
    </Box>
  );
}

function PairMenu({ onUnshare, onBlock }: { onUnshare: () => void; onBlock: () => void }) {
  return (
    <Menu position="bottom-end" withinPortal shadow="md">
      <Menu.Target>
        <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Opciones">
          ⋯
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={onUnshare}>Dejar de compartir mi contacto</Menu.Item>
        <Menu.Item color="red" onClick={onBlock}>
          Bloquear
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function ContactLinks({ p, eventId }: { p: ContactPair; eventId: string }) {
  const c = p.contact;
  if (!c) return null;
  const saveVCard = () => {
    const blob = new Blob([contactVCard(p)], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.name.replace(/[^\p{L}\p{N} ]/gu, "").trim() || "contacto"}.vcf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    trackEvent("contact_vcard", { event_id: eventId });
  };
  return (
    <Stack gap={4} mt={2}>
      {c.note && (
        <Text size="xs" c="dark.6" fs="italic">
          “{c.note}”
        </Text>
      )}
      <Group gap={6}>
        {c.whatsapp && (
          <Button
            component="a"
            href={`https://wa.me/${c.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            size="compact-xs"
            color="green"
            variant="light"
            onClick={() => trackEvent("contact_whatsapp", { event_id: eventId })}
          >
            WhatsApp
          </Button>
        )}
        {c.email && (
          <Button
            component="a"
            href={`mailto:${c.email}`}
            size="compact-xs"
            variant="light"
            onClick={() => trackEvent("contact_email", { event_id: eventId })}
          >
            Correo
          </Button>
        )}
        <Button size="compact-xs" variant="subtle" color="gray" onClick={saveVCard}>
          Guardar
        </Button>
      </Group>
      <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
        {[c.email, c.whatsapp && `+${c.whatsapp}`].filter(Boolean).join(" · ")}
      </Text>
    </Stack>
  );
}

/** Elige qué compartir (correo y/o WhatsApp) y acepta la autorización de la organización */
function CardEditor({
  eventId,
  data,
  accent,
  onDone,
}: {
  eventId: string;
  data: MyContacts;
  accent: string;
  onDone: () => Promise<void>;
}) {
  const initial = data.card ?? { email: data.defaults?.email ?? "", whatsapp: data.defaults?.whatsapp ?? "", note: "" };
  const [useEmail, setUseEmail] = useState(data.card ? !!data.card.email : !!data.defaults?.email);
  const [useWa, setUseWa] = useState(data.card ? !!data.card.whatsapp : !!data.defaults?.whatsapp);
  const [email, setEmail] = useState(initial.email ?? "");
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp ?? "");
  const [note, setNote] = useState(initial.note ?? "");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const waDigits = whatsapp.replace(/\D/g, "");
  const emailOk = !useEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const waOk = !useWa || (waDigits.length >= 7 && waDigits.length <= 15);
  const canSave = (useEmail || useWa) && emailOk && waOk && consent;

  const save = async () => {
    setSaving(true);
    try {
      await saveContactCard(eventId, {
        email: useEmail ? email.trim() : undefined,
        whatsapp: useWa ? waDigits : undefined,
        note: note.trim() || undefined,
        consent: true,
      });
      trackEvent("contact_card_saved", { event_id: eventId, email: useEmail, whatsapp: useWa });
      await onDone();
    } catch (err) {
      notifications.show({ message: apiMessage(err, "No se pudo guardar tu tarjeta"), color: "red" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await deleteContactCard(eventId);
      notifications.show({ message: "Retiraste tu autorización: ya no compartes tu contacto", color: "green" });
      await onDone();
    } catch (err) {
      notifications.show({ message: apiMessage(err, "No se pudo retirar la autorización"), color: "red" });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Elige qué datos verán los colegas con quienes aceptes intercambiar contacto. Solo los verán si ellos también
        comparten el suyo.
      </Text>
      <Checkbox label="Correo" checked={useEmail} onChange={(e) => setUseEmail(e.currentTarget.checked)} />
      {useEmail && (
        <TextInput
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          placeholder="tu@correo.com"
          error={!emailOk ? "Correo no válido" : undefined}
          maxLength={160}
        />
      )}
      <Checkbox label="WhatsApp" checked={useWa} onChange={(e) => setUseWa(e.currentTarget.checked)} />
      {useWa && (
        <TextInput
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.currentTarget.value)}
          placeholder="573001234567"
          description="Con indicativo del país, sin espacios"
          error={!waOk ? "Número no válido" : undefined}
          maxLength={20}
        />
      )}
      <Textarea
        label="Nota (opcional)"
        placeholder="Ej.: Endocrinólogo en Medellín, escríbeme por WhatsApp"
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
        maxLength={140}
        autosize
        minRows={1}
      />
      <Alert variant="light" color="gray" p="xs">
        <Text size="xs" style={{ whiteSpace: "pre-wrap" }}>
          {data.consentText}
        </Text>
      </Alert>
      <Checkbox
        label="Acepto y autorizo"
        checked={consent}
        onChange={(e) => setConsent(e.currentTarget.checked)}
      />
      <Group justify="space-between" mt="xs">
        {data.card ? (
          <Button variant="subtle" color="red" size="xs" loading={removing} onClick={() => void remove()}>
            Retirar autorización
          </Button>
        ) : (
          <span />
        )}
        <Button loading={saving} disabled={!canSave} onClick={() => void save()} style={{ background: canSave ? accent : undefined, color: canSave ? readableOn(accent) : undefined }}>
          Guardar
        </Button>
      </Group>
    </Stack>
  );
}
