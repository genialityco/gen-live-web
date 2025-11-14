import { Badge } from "@mantine/core";

export default function StatusBadge({
  status,
}: {
  status: "upcoming" | "live" | "ended" | "replay";
}) {
  const color =
    status === "live"
      ? "red"
      : status === "upcoming"
      ? "blue"
      : status === "replay"
      ? "grape"
      : "gray";

  const label =
    status === "live"
      ? "EN VIVO"
      : status === "upcoming"
      ? "Próximo"
      : status === "replay"
      ? "Repetición"
      : "Finalizado";

  return (
    <Badge color={color} variant="filled">
      {label}
    </Badge>
  );
}
