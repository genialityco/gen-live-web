import {
  Stack,
  Title,
  Card,
  Text,
  Button,
  TextInput,
  Textarea,
  Group,
  Collapse,
  Alert,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useState } from "react";
import { IconChevronDown, IconChevronRight, IconCheck, IconAlertCircle } from "@tabler/icons-react";
import { type EventItem, type EventBrandingConfig, updateEvent } from "../../api/events";
import EventBrandingConfigurator from "./EventBrandingConfigurator";
import "dayjs/locale/es";

interface EventAdminSettingsProps {
  event: EventItem;
}

export default function EventAdminSettings({ event }: EventAdminSettingsProps) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || "");
  const [startsAt, setStartsAt] = useState<string | null>(
    event.schedule?.startsAt || null
  );
  const [endsAt, setEndsAt] = useState<string | null>(
    event.schedule?.endsAt || null
  );
  
  const [showBrandingConfig, setShowBrandingConfig] = useState(false);

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      await updateEvent(event._id, {
        title,
        description: description || undefined,
        schedule: {
          startsAt: startsAt || undefined,
          endsAt: endsAt || undefined,
        },
      });

      setSuccess(true);
      setEditing(false);
      
      // Recargar la página después de 1 segundo
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error("Error al guardar:", err);
      setError("Error al guardar los cambios");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setTitle(event.title);
    setDescription(event.description || "");
    setStartsAt(event.schedule?.startsAt || null);
    setEndsAt(event.schedule?.endsAt || null);
    setEditing(false);
    setError(null);
    setSuccess(false);
  };

  const handleBrandingUpdate = (branding: EventBrandingConfig) => {
    // TODO: Actualizar el evento con el nuevo branding
    console.log("Branding actualizado:", branding);
  };

  return (
    <Stack gap="xl">
      <div>
        <Title order={1}>Configuración del evento</Title>
        <Text c="dimmed" size="lg">
          {event.title}
        </Text>
      </div>

      {error && (
        <Alert color="red" title="Error" icon={<IconAlertCircle size={16} />}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert color="green" title="¡Guardado!" icon={<IconCheck size={16} />}>
          Los cambios se guardaron correctamente
        </Alert>
      )}

      {/* Información básica */}
      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Title order={3}>Información básica</Title>
            {!editing ? (
              <Button 
                onClick={() => setEditing(true)}
                variant="light"
                size="sm"
              >
                ✏️ Editar
              </Button>
            ) : (
              <Group gap="sm">
                <Button 
                  onClick={handleCancel}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSave}
                  variant="filled"
                  size="sm"
                  loading={loading}
                >
                  Guardar cambios
                </Button>
              </Group>
            )}
          </Group>

          <Stack gap="md">
            {editing ? (
              <>
                <TextInput
                  label="Título del evento"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={loading}
                />
                <Textarea
                  label="Descripción"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe tu evento..."
                  disabled={loading}
                />
                <Group grow>
                  <DateTimePicker
                    label="Fecha y hora de inicio"
                    placeholder="Selecciona fecha y hora"
                    value={startsAt ? new Date(startsAt) : null}
                    onChange={(date) => setStartsAt(date ? new Date(date as string).toISOString() : null)}
                    valueFormat="DD/MM/YYYY HH:mm"
                    disabled={loading}
                    clearable
                  />
                  <DateTimePicker
                    label="Fecha y hora de finalización"
                    placeholder="Selecciona fecha y hora"
                    value={endsAt ? new Date(endsAt) : null}
                    onChange={(date) => setEndsAt(date ? new Date(date as string).toISOString() : null)}
                    valueFormat="DD/MM/YYYY HH:mm"
                    disabled={loading}
                    clearable
                    minDate={startsAt ? new Date(startsAt) : undefined}
                  />
                </Group>
              </>
            ) : (
              <>
                <div>
                  <Text size="sm" fw={500} c="dimmed">Título</Text>
                  <Text>{event.title}</Text>
                </div>
                {event.description && (
                  <div>
                    <Text size="sm" fw={500} c="dimmed">Descripción</Text>
                    <Text style={{ whiteSpace: 'pre-wrap' }}>{event.description}</Text>
                  </div>
                )}
                <Group grow>
                  <div>
                    <Text size="sm" fw={500} c="dimmed">Fecha de inicio</Text>
                    <Text>
                      {startsAt 
                        ? new Date(startsAt).toLocaleDateString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'No definida'}
                    </Text>
                  </div>
                  <div>
                    <Text size="sm" fw={500} c="dimmed">Fecha de finalización</Text>
                    <Text>
                      {endsAt 
                        ? new Date(endsAt).toLocaleDateString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'No definida'}
                    </Text>
                  </div>
                </Group>
              </>
            )}
          </Stack>
        </Stack>
      </Card>

      {/* Branding del evento */}
      <Card withBorder radius="lg" p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Title order={3}>Branding del evento</Title>
            <Button 
              size="sm" 
              variant="light"
              leftSection={showBrandingConfig ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              onClick={() => setShowBrandingConfig(!showBrandingConfig)}
            >
              {showBrandingConfig ? 'Ocultar' : 'Mostrar'} configuración
            </Button>
          </Group>

          <Text c="dimmed" size="sm">
            Personaliza los colores, imágenes y diseño específico de este evento
          </Text>

          <Collapse in={showBrandingConfig}>
            <EventBrandingConfigurator 
              event={event}
              onUpdate={handleBrandingUpdate}
            />
          </Collapse>
        </Stack>
      </Card>
    </Stack>
  );
}