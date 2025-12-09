/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from "react";
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
import { ref, onValue, off } from "firebase/database";
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

  useEffect(() => {
    
    if (!eventId) {
      return;
    }

    try {
      const activePollRef = ref(rtdb, `events/${eventId}/activePoll`);

      const unsubscribe = onValue(activePollRef, (snapshot) => {
        const data = snapshot.val();
        
        if (data && data.status === "published") {
          setActivePoll(data);
          setDrawerOpen(true); // Abrir automáticamente cuando se publica
          
          // Solo verificar si tenemos orgAttendeeId
          if (!orgAttendeeId) {
            console.log('[LivePollViewer] Waiting for orgAttendeeId...');
            setCheckingResponse(false);
            // Inicializar respuestas vacías mientras tanto
            const initialAnswers: Record<string, string[]> = {};
            data.questions.forEach((q: PollQuestion) => {
              initialAnswers[q.id] = [];
            });
            setAnswers(initialAnswers);
            return;
          }
          
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
                const initialAnswers: Record<string, string[]> = {};
                data.questions.forEach((q: PollQuestion) => {
                  initialAnswers[q.id] = [];
                });
                setAnswers(initialAnswers);
              }
            })
            .catch((err) => {
              console.error('Error checking if user responded:', err);
              // En caso de error, permitir responder
              setHasResponded(false);
              const initialAnswers: Record<string, string[]> = {};
              data.questions.forEach((q: PollQuestion) => {
                initialAnswers[q.id] = [];
              });
              setAnswers(initialAnswers);
            })
            .finally(() => {
              setCheckingResponse(false);
            });
        } else {
          // Si se despublica, cerrar el drawer
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
  }, [eventId, orgAttendeeId]);

  // Escuchar actualizaciones en tiempo real de las estadísticas
  useEffect(() => {
    if (!activePoll || !activePoll.showStatistics) return;

    const pollRef = ref(rtdb, `events/${eventId}/polls/${activePoll.id}`);

    onValue(pollRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setActivePoll((prev) => (prev ? { ...prev, ...data } : null));
      }
    });

    return () => {
      off(pollRef);
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
                  {activePoll.questions.map((question, index) => (
                    <Card key={question.id} withBorder radius="md" p="md">
                      <Stack gap="sm">
                        <Box>
                          <Text fw={600} size="sm">
                            {index + 1}. {question.text}
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
                                  checked={answers[question.id]?.includes(option.id)}
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
