/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Drawer,
  Stack,
  Title,
  Text,
  Button,
  Radio,
  Checkbox,
  Card,
  Alert,
  Progress,
  Box,
  Group,
  Badge,
  ActionIcon,
  Affix,
  Transition,
} from "@mantine/core";
import { IconCheck, IconAlertCircle, IconX, IconChartBar } from "@tabler/icons-react";
import { ref, onValue } from "firebase/database";
import { rtdb } from "../../core/firebase";
import { submitPollResponse, checkIfUserResponded, type PollAnswer } from "../../api/polls";

interface PollOption {
  id: string;
  text: string;
  votes?: number;
}

interface PollQuestion {
  id: string;
  text: string;
  type: "single_choice" | "multiple_choice";
  options: PollOption[];
  required?: boolean;
}

interface ActivePoll {
  id: string;
  title: string;
  description?: string;
  status: string;
  showStatistics: boolean;
  totalResponses: number;
  questions: PollQuestion[];
}

/**
 * Fusiona una actualización de la encuesta sin reemplazar la estructura de
 * preguntas/opciones: sólo refresca los votos. Así los ids que usan los
 * Radio/Checkbox permanecen estables y la selección del usuario no se pierde
 * cuando llega un snapshot de Firebase (p. ej. cuando otro asistente vota).
 */
function mergePollStats(prev: ActivePoll, next: Partial<ActivePoll>): ActivePoll {
  const incoming = next.questions;

  const questions = incoming
    ? prev.questions.map((question) => {
        const updated = incoming.find((q) => q.id === question.id);
        if (!updated) return question;

        return {
          ...question,
          options: question.options.map((option) => {
            const updatedOption = updated.options?.find((o) => o.id === option.id);
            return updatedOption ? { ...option, votes: updatedOption.votes } : option;
          }),
        };
      })
    : prev.questions;

  return { ...prev, ...next, id: prev.id, questions };
}

interface LivePollViewerProps {
  orgSlug: string;
  eventSlug: string;
  eventId: string;
  orgAttendeeId: string | null;
}

export default function LivePollViewer({
  orgSlug,
  eventSlug,
  eventId,
  orgAttendeeId,
}: LivePollViewerProps) {
  const [activePoll, setActivePoll] = useState<ActivePoll | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hasResponded, setHasResponded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true); // Control manual del drawer
  const [, setCheckingResponse] = useState(false);

  // Encuesta que ya se abrió automáticamente: evita reabrir el drawer en cada
  // actualización del nodo activePoll (votos, totalResponses, reconexiones...)
  const openedPollIdRef = useRef<string | null>(null);
  // Clave pollId:orgAttendeeId ya verificada contra el backend
  const checkedKeyRef = useRef<string | null>(null);
  // Encuesta cuyas respuestas ya se inicializaron
  const answersPollIdRef = useRef<string | null>(null);

  // Inicializa las respuestas vacías UNA sola vez por encuesta. Los snapshots
  // posteriores no deben tocar `answers` o borrarían lo que el usuario marcó.
  const ensureAnswers = useCallback((pollId: string, questions: PollQuestion[]) => {
    if (answersPollIdRef.current === pollId) return;
    answersPollIdRef.current = pollId;

    const initialAnswers: Record<string, string[]> = {};
    questions.forEach((q) => {
      initialAnswers[q.id] = [];
    });
    setAnswers(initialAnswers);
  }, []);

  useEffect(() => {
    
    if (!eventId) {
      return;
    }

    try {
      const activePollRef = ref(rtdb, `events/${eventId}/activePoll`);

      const unsubscribe = onValue(activePollRef, (snapshot) => {
        const data = snapshot.val();
        
        if (data && data.status === "published") {
          setActivePoll((prev) =>
            prev && prev.id === data.id ? mergePollStats(prev, data) : data
          );

          // Abrir automáticamente solo la primera vez que se publica esta
          // encuesta; si el usuario ya cerró el drawer, respetamos su decisión
          if (openedPollIdRef.current !== data.id) {
            openedPollIdRef.current = data.id;
            setDrawerOpen(true);
            setSubmitted(false);
            setHasResponded(false);
            setError("");
          }

          // Solo verificar si tenemos orgAttendeeId
          if (!orgAttendeeId) {
            console.log('[LivePollViewer] Waiting for orgAttendeeId...');
            setCheckingResponse(false);
            // Inicializar respuestas vacías mientras tanto
            ensureAnswers(data.id, data.questions);
            return;
          }

          // Verificar una sola vez por encuesta/asistente
          const checkKey = `${data.id}:${orgAttendeeId}`;
          if (checkedKeyRef.current === checkKey) {
            return;
          }
          checkedKeyRef.current = checkKey;

          // Verificar en el backend si el usuario ya respondió esta encuesta
          setCheckingResponse(true);
          console.log('[LivePollViewer] Checking if user responded - pollId:', data.id, 'orgAttendeeId:', orgAttendeeId);
          checkIfUserResponded(orgSlug, eventSlug, data.id, orgAttendeeId)
            .then((result) => {
              console.log('[LivePollViewer] Check result:', result);
              setHasResponded(result.hasResponded);
              setSubmitted(result.hasResponded);
              
              // Inicializar respuestas vacías solo si no ha respondido
              if (!result.hasResponded) {
                ensureAnswers(data.id, data.questions);
              }
            })
            .catch((err) => {
              console.error('Error checking if user responded:', err);
              // En caso de error, permitir responder y reintentar la próxima vez
              checkedKeyRef.current = null;
              setHasResponded(false);
              ensureAnswers(data.id, data.questions);
            })
            .finally(() => {
              setCheckingResponse(false);
            });
        } else {
          // Si se despublica, cerrar el drawer
          openedPollIdRef.current = null;
          checkedKeyRef.current = null;
          answersPollIdRef.current = null;
          setActivePoll(null);
          setSubmitted(false);
          setHasResponded(false);
          setAnswers({});
          setDrawerOpen(false);
        }
      }, (error) => {
        console.error('[LivePollViewer] Firebase error:', error);
      });

      return () => {
        unsubscribe();
      };
    } catch (err) {
      console.error('[LivePollViewer] Error setting up listener:', err);
    }
  }, [eventId, orgAttendeeId, ensureAnswers]);

  // Escuchar actualizaciones en tiempo real de las estadísticas
  useEffect(() => {
    if (!activePoll || !activePoll.showStatistics) return;

    const pollRef = ref(rtdb, `events/${eventId}/polls/${activePoll.id}`);

    const unsubscribe = onValue(pollRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setActivePoll((prev) => (prev ? mergePollStats(prev, data) : null));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [eventId, activePoll?.id, activePoll?.showStatistics]);

  const handleAnswerChange = (questionId: string, optionId: string, isMultiple: boolean) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      
      if (isMultiple) {
        // Checkbox: agregar o quitar
        if (current.includes(optionId)) {
          return { ...prev, [questionId]: current.filter((id) => id !== optionId) };
        } else {
          return { ...prev, [questionId]: [...current, optionId] };
        }
      } else {
        // Radio: reemplazar
        return { ...prev, [questionId]: [optionId] };
      }
    });
  };

  const handleSubmit = async () => {
    try {
      setError("");
      setSubmitting(true);

      // Validar preguntas requeridas
      const requiredQuestions = activePoll!.questions.filter((q) => q.required);
      for (const question of requiredQuestions) {
        if (!answers[question.id] || answers[question.id].length === 0) {
          setError(`La pregunta "${question.text}" es obligatoria`);
          setSubmitting(false);
          return;
        }
      }

      // Construir respuesta
      const pollAnswers: PollAnswer[] = Object.entries(answers)
        .filter(([, options]) => options.length > 0)
        .map(([questionId, selectedOptions]) => ({
          questionId,
          selectedOptions,
        }));

      console.log('[LivePollViewer] Submitting poll response - orgAttendeeId:', orgAttendeeId);
      console.log('[LivePollViewer] Submitting poll response - payload:', {
        answers: pollAnswers,
        orgAttendeeId: orgAttendeeId || undefined,
      });

      await submitPollResponse(orgSlug, eventSlug, activePoll!.id, {
        answers: pollAnswers,
        orgAttendeeId: orgAttendeeId || undefined,
      });
      
      setSubmitted(true);
      setHasResponded(true);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const errorMsg = error.response?.data?.message || "Error al enviar respuesta";
      setError(errorMsg);
      
      // Si el error es que ya respondió, marcar como respondido
      if (errorMsg.includes("Ya has respondido")) {
        setHasResponded(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const calculatePercentage = (votes: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
  };

  const getTotalVotes = (question: PollQuestion) => {
    return question.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
  };

  const isPollActive = activePoll !== null && activePoll.status === "published";
  const isDrawerOpen = isPollActive && drawerOpen;

  return (
    <>
      <Drawer
        opened={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        position="right"
        size={450}
        withCloseButton={false}
        styles={{
          body: { padding: 0, height: '100%' },
        }}
      >
        {activePoll && (
          <Stack gap={0} style={{ height: '100%' }}>
            {/* Header */}
            <Box
              p="lg"
              style={{
                background: 'linear-gradient(135deg, var(--mantine-color-blue-6) 0%, var(--mantine-color-blue-7) 100%)',
                color: 'white',
                borderBottom: '1px solid var(--mantine-color-gray-3)',
              }}
            >
              <Group justify="space-between" align="start">
                <Box style={{ flex: 1 }}>
                  <Title order={3} c="white">
                    {activePoll.title}
                  </Title>
                  {activePoll.description && (
                    <Text size="sm" c="white" opacity={0.9} mt="xs">
                      {activePoll.description}
                    </Text>
                  )}
                </Box>
                <ActionIcon
                  variant="subtle"
                  color="white"
                  size="lg"
                  onClick={() => setDrawerOpen(false)}
                  title="Cerrar"
                >
                  <IconX size={20} />
                </ActionIcon>
              </Group>
            </Box>

          {/* Content */}
          <Box p="lg" style={{ flex: 1, overflow: 'auto' }}>
            {hasResponded || submitted ? (
              <Stack gap="lg">
                <Alert
                  color="green"
                  title="¡Respuesta enviada!"
                  icon={<IconCheck />}
                >
                  Gracias por responder. Tu opinión ha sido registrada.
                </Alert>

                {activePoll.showStatistics && (
                  <Stack gap="md">
                    <Box>
                      <Title order={4}>Resultados en tiempo real</Title>
                      <Group gap="xs" mt={4}>
                        <Badge size="lg" variant="light" color="blue">
                          👥 {activePoll.totalResponses} respuesta(s)
                        </Badge>
                      </Group>
                    </Box>

                    <Stack gap="md">
                      {activePoll.questions.map((question) => {
                        const totalVotes = getTotalVotes(question);
                        
                        return (
                          <Card key={question.id} withBorder radius="md" p="md">
                            <Stack gap="sm">
                              <Box>
                                <Text fw={600} size="sm">
                                  {question.text}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {totalVotes} voto(s)
                                </Text>
                              </Box>

                              <Stack gap="xs">
                                {question.options.map((option) => {
                                  const percentage = calculatePercentage(
                                    option.votes || 0,
                                    totalVotes
                                  );

                                  return (
                                    <Box key={option.id}>
                                      <Group justify="space-between" mb={4}>
                                        <Text size="sm">{option.text}</Text>
                                        <Text size="sm" fw={600}>
                                          {option.votes || 0} ({percentage}%)
                                        </Text>
                                      </Group>
                                      <Progress
                                        value={percentage}
                                        size="md"
                                        radius="sm"
                                        animated
                                      />
                                    </Box>
                                  );
                                })}
                              </Stack>
                            </Stack>
                          </Card>
                        );
                      })}
                    </Stack>
                  </Stack>
                )}
              </Stack>
            ) : (
              <Stack gap="lg">
                <Text size="sm" c="dimmed">
                  Por favor responde las siguientes preguntas:
                </Text>

                {error && (
                  <Alert
                    color="red"
                    title="Error"
                    icon={<IconAlertCircle />}
                    withCloseButton
                    onClose={() => setError("")}
                  >
                    {error}
                  </Alert>
                )}

                <Stack gap="md">
                  {activePoll.questions.map((question) => (
                    <Card key={question.id} withBorder radius="md" p="md">
                      <Stack gap="sm">
                        <Box>
                          <Text fw={600} size="sm">
                            {question.text}
                            {question.required && (
                              <Text component="span" c="red" ml={4}>
                                *
                              </Text>
                            )}
                          </Text>
                          <Text size="xs" c="dimmed" mt={2}>
                            {question.type === "multiple_choice"
                              ? "Selecciona una o más opciones"
                              : "Selecciona una opción"}
                          </Text>
                        </Box>

                        <Stack gap="xs" mt="xs">
                          {question.type === "single_choice" ? (
                            <Radio.Group
                              value={answers[question.id]?.[0] || ""}
                              onChange={(value) =>
                                handleAnswerChange(question.id, value, false)
                              }
                            >
                              <Stack gap="xs">
                                {question.options.map((option) => (
                                  <Radio
                                    key={option.id}
                                    value={option.id}
                                    label={option.text}
                                  />
                                ))}
                              </Stack>
                            </Radio.Group>
                          ) : (
                            <Stack gap="xs">
                              {question.options.map((option) => (
                                <Checkbox
                                  key={option.id}
                                  label={option.text}
                                  checked={answers[question.id]?.includes(option.id) ?? false}
                                  onChange={() =>
                                    handleAnswerChange(question.id, option.id, true)
                                  }
                                />
                              ))}
                            </Stack>
                          )}
                        </Stack>
                      </Stack>
                    </Card>
                  ))}
                </Stack>

                <Button
                  fullWidth
                  size="lg"
                  onClick={handleSubmit}
                  loading={submitting}
                  disabled={submitting}
                >
                  {submitting ? "Enviando..." : "Enviar respuestas"}
                </Button>
              </Stack>
            )}
          </Box>
        </Stack>
      )}
    </Drawer>

    {/* Botón flotante para reabrir el drawer */}
    <Affix position={{ bottom: 10, right: 10 }}>
      <Transition transition="slide-up" mounted={isPollActive && !drawerOpen}>
        {(transitionStyles) => (
          <ActionIcon
            size={60}
            radius="xl"
            variant="filled"
            color="blue"
            style={{
              ...transitionStyles,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
            onClick={() => setDrawerOpen(true)}
            title="Abrir encuesta"
          >
            <IconChartBar size={28} />
          </ActionIcon>
        )}
      </Transition>
    </Affix>
    </>
  );
}
