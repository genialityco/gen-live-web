import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Container,
  Stack,
  Text,
  Loader,
  Alert,
  Center,
  Card,
  Box,
  Group,
  Badge,
  Progress,
} from "@mantine/core";
import { IconAlertCircle, IconClock } from "@tabler/icons-react";
import { ref, onValue } from "firebase/database";
import {
  getPublicPollResults,
  type PollStatistics,
  type PublicPollResults,
} from "../../api/polls";
import { ensureAnon, rtdb } from "../../core/firebase";
import PublicEventHeader from "../../components/events/PublicEventHeader";

// Respaldo por HTTP por si la conexión a RTDB falla; los votos llegan en
// tiempo real por la suscripción a Firebase.
const POLL_INTERVAL_MS = 30_000;

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  draft: { label: "Aún no publicada", color: "gray" },
  published: { label: "En vivo", color: "green" },
  closed: { label: "Cerrada", color: "red" },
};

/** Nodo events/{eventId}/polls/{pollId} que escribe el backend en cada voto */
interface RtdbPoll {
  status?: string;
  showStatistics?: boolean;
  totalResponses?: number;
  questions?: {
    id: string;
    options?: { id: string; votes?: number }[];
  }[];
}

/**
 * Aplica un snapshot de RTDB sobre las estadísticas actuales: refresca votos,
 * totales y porcentajes (mismo cálculo que el backend) sin tocar textos.
 */
function applyRtdbPoll(prev: PollStatistics, live: RtdbPoll): PollStatistics {
  const questions = prev.questions.map((question) => {
    const liveQ = live.questions?.find((q) => q.id === question.id);
    if (!liveQ) return question;

    const options = question.options.map((option) => {
      const liveO = liveQ.options?.find((o) => o.id === option.id);
      return liveO ? { ...option, votes: Number(liveO.votes ?? 0) } : option;
    });
    const totalVotes = options.reduce((sum, o) => sum + o.votes, 0);

    return {
      ...question,
      totalVotes,
      options: options.map((o) => ({
        ...o,
        percentage:
          totalVotes > 0
            ? parseFloat(((o.votes / totalVotes) * 100).toFixed(2))
            : 0,
      })),
    };
  });

  return {
    ...prev,
    status: live.status ?? prev.status,
    showStatistics: live.showStatistics ?? prev.showStatistics,
    totalResponses: live.totalResponses ?? prev.totalResponses,
    questions,
  };
}

/**
 * Página PÚBLICA de resultados de una encuesta (compartible por enlace, sin
 * login). Solo responde si el admin activó "mostrar estadísticas" en la
 * encuesta; no da acceso a ninguna otra sección del admin. Los votos se
 * actualizan en tiempo real escuchando RTDB, con polling HTTP de respaldo.
 */
export default function PollResultsPublic() {
  const { eventSlug, pollId } = useParams<{
    slug: string;
    eventSlug: string;
    pollId: string;
  }>();
  const [data, setData] = useState<PublicPollResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const firstLoad = useRef(true);
  const eventId = data?.poll.eventId;

  useEffect(() => {
    if (!eventSlug || !pollId) {
      setError("Encuesta no encontrada");
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const res = await getPublicPollResults(eventSlug, pollId);
        if (cancelled) return;
        setData(res);
        setError(null);
      } catch (err: unknown) {
        console.error("Error loading public poll results:", err);
        if (!cancelled && firstLoad.current) {
          const e = err as { response?: { data?: { message?: string } } };
          setError(
            e.response?.data?.message ||
              "No se pudieron cargar los resultados de la encuesta"
          );
        }
      } finally {
        if (!cancelled) {
          firstLoad.current = false;
          setLoading(false);
        }
      }
    };

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [eventSlug, pollId]);

  // Suscripción en tiempo real a los votos (el backend sincroniza este nodo
  // en cada respuesta, cambio de estado o de visibilidad de estadísticas)
  useEffect(() => {
    if (!eventId || !pollId) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    ensureAnon()
      .then(() => {
        if (cancelled) return;
        unsubscribe = onValue(
          ref(rtdb, `events/${eventId}/polls/${pollId}`),
          (snapshot) => {
            const live = snapshot.val() as RtdbPoll | null;
            if (!live) return;
            if (live.showStatistics === false) {
              setError("Los resultados de esta encuesta no son públicos");
              return;
            }
            setError(null);
            setData((prev) =>
              prev ? { ...prev, poll: applyRtdbPoll(prev.poll, live) } : prev
            );
          },
          (err) => console.error("RTDB poll results listener error:", err)
        );
      })
      .catch((err) => console.error("Anonymous auth failed:", err));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [eventId, pollId]);

  if (loading) {
    return (
      <Center mih="60vh">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">
            Cargando resultados...
          </Text>
        </Stack>
      </Center>
    );
  }

  if (error || !data) {
    return (
      <Container size="sm" py="xl">
        <Alert
          variant="filled"
          color="red"
          title="Resultados no disponibles"
          icon={<IconAlertCircle />}
        >
          {error || "Sin datos"}
        </Alert>
      </Container>
    );
  }

  const { poll } = data;
  const statusInfo = STATUS_INFO[poll.status] ?? { label: poll.status, color: "gray" };

  return (
    <Container size="md" py="xl">
      <PublicEventHeader
        title={data.event.title}
        startsAt={data.event.schedule?.startsAt}
        orgName={data.org.name}
        logoUrl={data.org.branding?.logoUrl}
      />

      <Card withBorder radius="lg" p="lg" mb="lg">
        <Group justify="space-between" align="start">
          <Box>
            <Group gap="xs" mb={4}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Resultados de la encuesta
              </Text>
              <Badge size="sm" variant="light" color={statusInfo.color}>
                {statusInfo.label}
              </Badge>
            </Group>
            <Text size="xl" fw={700}>
              {poll.title}
            </Text>
          </Box>
          <Badge size="lg" variant="light" color="blue">
            👥 {poll.totalResponses} respuesta(s)
          </Badge>
        </Group>
      </Card>

      {poll.status === "draft" && (
        <Alert color="gray" variant="light" icon={<IconClock />} mb="md">
          Esta encuesta todavía no se ha publicado. Esta página se actualiza
          automáticamente y comenzará a mostrar resultados en vivo en cuanto
          el organizador la publique.
        </Alert>
      )}

      <Stack gap="md">
        {poll.questions.map((question) => (
          <Card key={question.id} withBorder radius="md" p="lg">
            <Stack gap="md">
              <Box>
                <Text fw={600}>{question.text}</Text>
                <Text size="sm" c="dimmed">
                  {question.totalVotes} voto(s)
                </Text>
              </Box>

              {question.totalVotes > 0 ? (
                <Stack gap="sm">
                  {question.options.map((option) => (
                    <Box key={option.id}>
                      <Group justify="space-between" mb={4}>
                        <Text size="sm">{option.text}</Text>
                        <Text size="sm" fw={600}>
                          {option.votes} ({option.percentage}%)
                        </Text>
                      </Group>
                      <Progress value={option.percentage} size="md" radius="sm" />
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Alert color="blue" variant="light">
                  Aún no hay votos para esta pregunta
                </Alert>
              )}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Container>
  );
}
