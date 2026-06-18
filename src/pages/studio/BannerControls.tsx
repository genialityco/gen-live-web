import { useEffect, useRef, useState } from "react";
import { Stack, Switch, Textarea, Button, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { setBanner } from "../../api/live-stage-service";
import { useStage } from "../../hooks/useStage";

interface BannerControlsProps {
  eventSlug: string;
  disabled?: boolean;
}

const MAX_LEN = 200;

export function BannerControls({ eventSlug, disabled }: BannerControlsProps) {
  const stage = useStage(eventSlug);
  const banner = stage.banner;

  const [text, setText] = useState("");
  const hydrated = useRef(false);

  // Hidratar el texto local con el valor de RTDB una sola vez (al primer dato),
  // para no pisar lo que el host esté escribiendo en cambios posteriores.
  useEffect(() => {
    if (hydrated.current) return;
    if (banner?.text !== undefined) {
      setText(banner.text);
      hydrated.current = true;
    }
  }, [banner?.text]);

  const visible = !!banner?.visible;
  const trimmed = text.trim();

  const handleToggle = async (next: boolean) => {
    try {
      await setBanner(eventSlug, { visible: next, text });
    } catch (err) {
      console.error("Error toggling banner:", err);
      notifications.show({ message: "Error al cambiar el banner", color: "red" });
    }
  };

  const handleUpdateText = async () => {
    try {
      await setBanner(eventSlug, { visible: true, text });
      notifications.show({ message: "Banner actualizado", color: "blue" });
    } catch (err) {
      console.error("Error updating banner:", err);
      notifications.show({ message: "Error al actualizar el banner", color: "red" });
    }
  };

  const textChanged = (banner?.text ?? "") !== text;

  return (
    <Stack gap="sm">
      <Textarea
        label="Mensaje del banner"
        placeholder="Ej: ¡Próximo sorteo en 5 minutos!"
        value={text}
        onChange={(e) => setText(e.currentTarget.value.slice(0, MAX_LEN))}
        autosize
        minRows={2}
        maxRows={4}
        disabled={disabled}
      />
      <Text size="xs" c="dimmed" ta="right">
        {text.length}/{MAX_LEN}
      </Text>

      <Group justify="space-between" align="center" wrap="nowrap">
        <Switch
          label="Mostrar en monitor y transmisión"
          checked={visible}
          onChange={(e) => handleToggle(e.currentTarget.checked)}
          disabled={disabled || !trimmed}
        />
        {visible && textChanged && (
          <Button size="xs" variant="light" onClick={handleUpdateText} disabled={disabled}>
            Actualizar
          </Button>
        )}
      </Group>

      <Text size="xs" c="dimmed">
        El banner aparece en la parte inferior del monitor y se graba/transmite en el egress en tiempo real.
      </Text>
    </Stack>
  );
}
