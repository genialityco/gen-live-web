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
  Modal,
  Divider,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import { IconChevronDown, IconChevronRight, IconCheck, IconAlertCircle, IconTrash } from "@tabler/icons-react";
import { type EventItem, type EventBrandingConfig, updateEvent, deleteEvent } from "../../api/events";
import EventBrandingConfigurator from "./EventBrandingConfigurator";
import "dayjs/locale/es";

interface EventAdminSettingsProps {
  event: EventItem;
}

export default function EventAdminSettings({ event }: EventAdminSettingsProps) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  
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
    console.log("Branding actualizado:", branding);
  };

  const handleDeleteEvent = async () => {
    setDeleting(true);
    try {
      await deleteEvent(event._id);
      notifications.show({
        title: "Evento eliminado",
        message: `"${event.title}" fue eliminado correctamente`,
        color: "green",
      });
      navigate(`/org/${slug}/admin/events`);
    } catch {
      notifications.show({
        title: "Error",
        message: "No se pudo eliminar el evento",
        color: "red",
      });
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
    }
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

      {/* Zona de peligro */}
      <Card withBorder radius="lg" p="lg" style={{ borderColor: "var(--mantine-color-red-4)" }}>
        <Stack gap="md">
          <div>
            <Title order={3} c="red">Zona de peligro</Title>
            <Text c="dimmed" size="sm" mt={4}>
              Las acciones de esta sección son permanentes e irreversibles.
            </Text>
          </div>

          <Divider color="red.2" />

          <Group justify="space-between" align="center">
            <div>
              <Text fw={500}>Eliminar evento</Text>
              <Text size="sm" c="dimmed">
                Borra el evento, todos sus asistentes registrados, métricas, encuestas, plantillas de email y campañas. Esta acción no se puede deshacer.
              </Text>
            </div>
            <Button
              color="red"
              variant="outline"
              leftSection={<IconTrash size={16} />}
              onClick={() => {
                setDeleteConfirmText("");
                setDeleteModalOpen(true);
              }}
            >
              Eliminar evento
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* Modal de confirmación */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title={<Text fw={700} c="red" size="lg">Eliminar evento</Text>}
        centered
        size="md"
      >
        <Stack gap="md">
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            Esta acción eliminará permanentemente:
            <ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
              <li>El evento y su configuración</li>
              <li>Todos los registros de asistentes</li>
              <li>Métricas y sesiones de visualización</li>
              <li>Encuestas y campañas de email</li>
              <li>Plantillas de email del evento</li>
              <li>Configuración de streaming</li>
            </ul>
          </Alert>

          <Text size="sm">
            Escribe el título del evento para confirmar:{" "}
            <Text component="span" fw={700}>{event.title}</Text>
          </Text>

          <TextInput
            placeholder={event.title}
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.currentTarget.value)}
            disabled={deleting}
          />

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              disabled={deleteConfirmText !== event.title}
              loading={deleting}
              onClick={handleDeleteEvent}
            >
              Confirmar eliminación
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}