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
import { IconAlertCircle } from "@tabler/icons-react";
import { getPublicPollResults, type PublicPollResults } from "../../api/polls";
import PublicEventHeader from "../../components/events/PublicEventHeader";

const POLL_INTERVAL_MS = 10_000;

/**
 * Página PÚBLICA de resultados de una encuesta (compartible por enlace, sin
 * login). Solo responde si el admin activó "mostrar estadísticas" en la
 * encuesta; no da acceso a ninguna otra sección del admin. Se actualiza por
 * polling al endpoint público (~cada 10s) para reflejar nuevos votos.
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
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Resultados de la encuesta
            </Text>
            <Text size="xl" fw={700}>
              {poll.title}
            </Text>
          </Box>
          <Badge size="lg" variant="light" color="blue">
            👥 {poll.totalResponses} respuesta(s)
          </Badge>
        </Group>
      </Card>

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
