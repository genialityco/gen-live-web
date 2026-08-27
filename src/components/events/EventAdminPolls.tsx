import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Stack,
  Title,
  Text,
  Button,
  Card,
  Group,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  Select,
  Switch,
  Alert,
  Loader,
  Center,
  Box,
  Divider,
  CopyButton,
  Tooltip as MantineTooltip,
  rem,
} from "@mantine/core";
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconChartBar,
  IconPlayerPlay,
  IconPlayerStop,
  IconLink,
  IconCheck,
} from "@tabler/icons-react";
import {
  getEventPolls,
  createPoll,
  updatePoll,
  updatePollStatus,
  togglePollStatistics,
  deletePoll,
  getPollStatistics,
  type Poll,
  type CreatePollData,
  type PollStatistics,
} from "../../api/polls";
import { ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];

export default function EventAdminPolls() {
  const { slug, eventSlug } = useParams<{ slug: string; eventSlug: string }>();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openStatsDialog, setOpenStatsDialog] = useState(false);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [statistics, setStatistics] = useState<PollStatistics | null>(null);
  const [error, setError] = useState<string>("");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showStatistics, setShowStatistics] = useState(false);
  const [questions, setQuestions] = useState<{
    text: string;
    type: "single_choice" | "multiple_choice";
    options: { text: string }[];
    required: boolean;
  }[]>([
    {
      text: "",
      type: "single_choice",
      options: [{ text: "" }, { text: "" }],
      required: true,
    },
  ]);

  useEffect(() => {
    loadPolls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, eventSlug]);

  const loadPolls = async () => {
    try {
      setLoading(true);
      const data = await getEventPolls(slug!, eventSlug!);
      setPolls(data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "Error al cargar encuestas");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (poll?: Poll) => {
    if (poll) {
      setEditingPoll(poll);
      setTitle(poll.title);
      setDescription(poll.description || "");
      setShowStatistics(poll.showStatistics);
      setQuestions(
        poll.questions.map((q) => ({
          text: q.text,
          type: q.type,
          options: q.options.map((o) => ({ text: o.text })),
          required: q.required ?? true,
        }))
      );
    } else {
      resetForm();
    }
    setOpenDialog(true);
  };

  const resetForm = () => {
    setEditingPoll(null);
    setTitle("");
    setDescription("");
    setShowStatistics(false);
    setQuestions([
      {
        text: "",
        type: "single_choice",
        options: [{ text: "" }, { text: "" }],
        required: true,
      },
    ]);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    resetForm();
  };

  const handleSavePoll = async () => {
    try {
      setError("");
      
      // Validaciones
      if (!title.trim()) {
        setError("El título es obligatorio");
        return;
      }

      if (questions.length === 0) {
        setError("Debe agregar al menos una pregunta");
        return;
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.text.trim()) {
          setError(`La pregunta ${i + 1} no puede estar vacía`);
          return;
        }
        if (q.options.length < 2) {
          setError(`La pregunta ${i + 1} debe tener al menos 2 opciones`);
          return;
        }
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].text.trim()) {
            setError(`La opción ${j + 1} de la pregunta ${i + 1} no puede estar vacía`);
            return;
          }
        }
      }

      const pollData: CreatePollData = {
        title,
        description,
        questions,
        showStatistics,
      };

      if (editingPoll) {
        await updatePoll(slug!, eventSlug!, editingPoll._id, pollData);
      } else {
        await createPoll(slug!, eventSlug!, pollData);
      }

      handleCloseDialog();
      loadPolls();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "Error al guardar encuesta");
    }
  };

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        text: "",
        type: "single_choice",
        options: [{ text: "" }, { text: "" }],
        required: true,
      },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, field: string, value: string | boolean | "single_choice" | "multiple_choice") => {
    const newQuestions = [...questions];
    (newQuestions[index] as Record<string, unknown>)[field] = value;
    setQuestions(newQuestions);
  };

  const handleAddOption = (questionIndex: number) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options.push({ text: "" });
    setQuestions(newQuestions);
  };

  const handleRemoveOption = (questionIndex: number, optionIndex: number) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options = newQuestions[
      questionIndex
    ].options.filter((_, i) => i !== optionIndex);
    setQuestions(newQuestions);
  };

  const handleOptionChange = (
    questionIndex: number,
    optionIndex: number,
    value: string
  ) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex].text = value;
    setQuestions(newQuestions);
  };

  const handlePublish = async (poll: Poll) => {
    try {
      await updatePollStatus(slug!, eventSlug!, poll._id, "published");
      loadPolls();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "Error al publicar encuesta");
    }
  };

  const handleUnpublish = async (poll: Poll) => {
    try {
      await updatePollStatus(slug!, eventSlug!, poll._id, "closed");
      loadPolls();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "Error al despublicar encuesta");
    }
  };

  const handleToggleStats = async (poll: Poll) => {
    try {
      await togglePollStatistics(slug!, eventSlug!, poll._id, !poll.showStatistics);
      loadPolls();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "Error al actualizar estadísticas");
    }
  };

  const handleViewStatistics = async (poll: Poll) => {
    try {
      const stats = await getPollStatistics(slug!, eventSlug!, poll._id);
      setStatistics(stats);
      setOpenStatsDialog(true);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "Error al cargar estadísticas");
    }
  };

  const handleDeletePoll = async (poll: Poll) => {
    if (window.confirm("¿Estás seguro de eliminar esta encuesta?")) {
      try {
        await deletePoll(slug!, eventSlug!, poll._id);
        loadPolls();
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || "Error al eliminar encuesta");
      }
    }
  };

  const getStatusColor = (status: string): "green" | "red" | "gray" => {
    switch (status) {
      case "published":
        return "green";
      case "closed":
        return "red";
      default:
        return "gray";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "published":
        return "Publicada";
      case "closed":
        return "Cerrada";
      default:
        return "Borrador";
    }
  };

  if (loading) {
    return (
      <Center h={400}>
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <div>
          <Title order={1}>Encuestas del Evento</Title>
          <Text c="dimmed" size="lg">
            Crea y gestiona encuestas para interactuar con los asistentes
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={20} />}
          onClick={() => handleOpenDialog()}
        >
          Nueva Encuesta
        </Button>
      </Group>

      {error && (
        <Alert color="red" title="Error" withCloseButton onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {polls.length === 0 ? (
        <Card withBorder radius="lg" p="xl">
          <Stack align="center" gap="md">
            <Text c="dimmed" size="lg" ta="center">
              No hay encuestas creadas. Crea tu primera encuesta para interactuar con los asistentes.
            </Text>
            <Button
              leftSection={<IconPlus size={20} />}
              onClick={() => handleOpenDialog()}
            >
              Crear primera encuesta
            </Button>
          </Stack>
        </Card>
      ) : (
        <Stack gap="md">
          {polls.map((poll) => (
            <Card key={poll._id} withBorder radius="lg" p="lg">
              <Group justify="space-between" align="start" wrap="nowrap">
                <Box style={{ flex: 1 }}>
                  <Group gap="sm" mb="xs">
                    <Title order={3}>{poll.title}</Title>
                    <Badge color={getStatusColor(poll.status)} variant="light">
                      {getStatusLabel(poll.status)}
                    </Badge>
                    {poll.showStatistics && (
                      <Badge color="blue" variant="light" leftSection={<IconEye size={14} />}>
                        Stats visibles
                      </Badge>
                    )}
                  </Group>
                  {poll.description && (
                    <Text c="dimmed" size="sm" mb="xs">
                      {poll.description}
                    </Text>
                  )}
                  <Text size="sm" c="dimmed">
                    📋 {poll.questions.length} pregunta(s) · 👥 {poll.totalResponses} respuesta(s)
                  </Text>
                </Box>

                <Group gap="xs" wrap="nowrap">
                  {poll.status === "draft" && (
                    <>
                      <ActionIcon
                        variant="light"
                        color="blue"
                        size="lg"
                        onClick={() => handleOpenDialog(poll)}
                        title="Editar"
                      >
                        <IconEdit size={18} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="green"
                        size="lg"
                        onClick={() => handlePublish(poll)}
                        title="Publicar"
                      >
                        <IconPlayerPlay size={18} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="lg"
                        onClick={() => handleDeletePoll(poll)}
                        title="Eliminar"
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    </>
                  )}

                  {poll.status === "published" && (
                    <>
                      <ActionIcon
                        variant="light"
                        color={poll.showStatistics ? "blue" : "gray"}
                        size="lg"
                        onClick={() => handleToggleStats(poll)}
                        title={poll.showStatistics ? "Ocultar estadísticas" : "Mostrar estadísticas"}
                      >
                        {poll.showStatistics ? <IconEye size={18} /> : <IconEyeOff size={18} />}
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="orange"
                        size="lg"
                        onClick={() => handleUnpublish(poll)}
                        title="Cerrar encuesta"
                      >
                        <IconPlayerStop size={18} />
                      </ActionIcon>
                    </>
                  )}

                  {poll.status === "closed" && (
                    <>
                      <ActionIcon
                        variant="light"
                        color="green"
                        size="lg"
                        onClick={() => handlePublish(poll)}
                        title="Reabrir encuesta"
                      >
                        <IconPlayerPlay size={18} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="lg"
                        onClick={() => handleDeletePoll(poll)}
                        title="Eliminar"
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    </>
                  )}

                  <ActionIcon
                    variant="light"
                    color="cyan"
                    size="lg"
                    onClick={() => handleViewStatistics(poll)}
                    title="Ver estadísticas"
                  >
                    <IconChartBar size={18} />
                  </ActionIcon>

                  {(poll.status === "published" || poll.status === "closed") && (
                    <CopyButton
                      value={`${window.location.origin}/org/${slug}/event/${eventSlug}/poll/${poll._id}/results`}
                      timeout={2000}
                    >
                      {({ copied, copy }) => (
                        <MantineTooltip
                          label={
                            copied
                              ? "¡Enlace copiado!"
                              : poll.showStatistics
                                ? "Copiar enlace público de resultados"
                                : "Copiar enlace público (actívalo con 'mostrar estadísticas' para que sea visible)"
                          }
                          withArrow
                        >
                          <ActionIcon
                            variant="light"
                            color={copied ? "teal" : "grape"}
                            size="lg"
                            onClick={copy}
                          >
                            {copied ? <IconCheck size={18} /> : <IconLink size={18} />}
                          </ActionIcon>
                        </MantineTooltip>
                      )}
                    </CopyButton>
                  )}
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      {/* Modal para crear/editar encuesta */}
      <Modal
        opened={openDialog}
        onClose={handleCloseDialog}
        title={<Title order={3}>{editingPoll ? "Editar Encuesta" : "Nueva Encuesta"}</Title>}
        size="lg"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Título de la encuesta"
            placeholder="¿Cómo calificarías el evento?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            withAsterisk
          />
          <Textarea
            label="Descripción (opcional)"
            placeholder="Ayúdanos a mejorar respondiendo esta breve encuesta..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <Switch
            label="Mostrar estadísticas en tiempo real a los asistentes"
            checked={showStatistics}
            onChange={(e) => setShowStatistics(e.currentTarget.checked)}
          />

          <Divider label="Preguntas" labelPosition="center" />

          <Stack gap="md">
            {questions.map((question, qIndex) => (
              <Card key={qIndex} withBorder radius="md" p="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Title order={5}>Pregunta {qIndex + 1}</Title>
                    {questions.length > 1 && (
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="sm"
                        onClick={() => handleRemoveQuestion(qIndex)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    )}
                  </Group>

                  <TextInput
                    label="Texto de la pregunta"
                    placeholder="¿Cuál es tu opinión sobre...?"
                    value={question.text}
                    onChange={(e) =>
                      handleQuestionChange(qIndex, "text", e.target.value)
                    }
                    required
                    withAsterisk
                  />

                  <Select
                    label="Tipo de respuesta"
                    value={question.type}
                    onChange={(value) =>
                      handleQuestionChange(qIndex, "type", value as "single_choice" | "multiple_choice")
                    }
                    data={[
                      { value: "single_choice", label: "Opción única" },
                      { value: "multiple_choice", label: "Opción múltiple" },
                    ]}
                  />

                  <Switch
                    label="Pregunta obligatoria"
                    checked={question.required}
                    onChange={(e) =>
                      handleQuestionChange(qIndex, "required", e.currentTarget.checked)
                    }
                  />

                  <Text size="sm" fw={500} mt="xs">Opciones de respuesta</Text>

                  <Stack gap="xs">
                    {question.options.map((option, oIndex) => (
                      <Group key={oIndex} gap="xs" align="flex-end" wrap="nowrap">
                        <TextInput
                          label={`Opción ${oIndex + 1}`}
                          placeholder="Escribe una opción..."
                          value={option.text}
                          onChange={(e) =>
                            handleOptionChange(qIndex, oIndex, e.target.value)
                          }
                          style={{ flex: 1 }}
                          required
                          withAsterisk
                        />
                        {question.options.length > 2 && (
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="lg"
                            onClick={() => handleRemoveOption(qIndex, oIndex)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    ))}
                  </Stack>

                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    onClick={() => handleAddOption(qIndex)}
                  >
                    Agregar opción
                  </Button>
                </Stack>
              </Card>
            ))}
          </Stack>

          <Button
            variant="outline"
            leftSection={<IconPlus size={16} />}
            onClick={handleAddQuestion}
          >
            Agregar pregunta
          </Button>

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSavePoll}>
              {editingPoll ? "Guardar cambios" : "Crear encuesta"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal para ver estadísticas */}
      <Modal
        opened={openStatsDialog}
        onClose={() => setOpenStatsDialog(false)}
        title={<Title order={3}>Estadísticas de la Encuesta</Title>}
        size="xl"
        centered
      >
        {statistics && (
          <Stack gap="xl">
            <Box>
              <Title order={4}>{statistics.title}</Title>
              <Text c="dimmed">
                👥 Total de respuestas: <strong>{statistics.totalResponses}</strong>
              </Text>
            </Box>

            {statistics.questions.map((question) => (
              <Card key={question.id} withBorder radius="md" p="lg">
                <Stack gap="md">
                  <Box>
                    <Title order={5}>{question.text}</Title>
                    <Text size="sm" c="dimmed">
                      Total de votos: {question.totalVotes}
                    </Text>
                  </Box>

                  {question.totalVotes > 0 ? (
                    <>
                      <Box style={{ height: rem(300) }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={question.options}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="text" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="votes" fill="#228BE6" name="Votos" />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>

                      <Stack gap="md">
                        {question.options.map((option, idx) => (
                          <Box key={option.id}>
                            <Group justify="space-between" mb={4}>
                              <Text size="sm">{option.text}</Text>
                              <Text size="sm" fw={600}>
                                {option.votes} ({option.percentage}%)
                              </Text>
                            </Group>
                            <Box
                              style={{
                                height: rem(8),
                                backgroundColor: 'var(--mantine-color-gray-2)',
                                borderRadius: rem(4),
                                overflow: 'hidden',
                              }}
                            >
                              <Box
                                style={{
                                  height: '100%',
                                  width: `${option.percentage}%`,
                                  backgroundColor: COLORS[idx % COLORS.length],
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </Box>
                          </Box>
                        ))}
                      </Stack>
                    </>
                  ) : (
                    <Alert color="blue">
                      Aún no hay respuestas para esta pregunta
                    </Alert>
                  )}
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
