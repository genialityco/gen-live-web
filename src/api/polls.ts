import { api } from "../core/api";

export interface PollOption {
  id: string;
  text: string;
  votes?: number;
}

export interface PollQuestion {
  id: string;
  text: string;
  type: 'single_choice' | 'multiple_choice';
  options: PollOption[];
  required?: boolean;
}

export interface Poll {
  _id: string;
  title: string;
  description?: string;
  eventId: string;
  questions: PollQuestion[];
  status: 'draft' | 'published' | 'closed';
  showStatistics: boolean;
  totalResponses: number;
  publishedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePollData {
  title: string;
  description?: string;
  questions: {
    text: string;
    type: 'single_choice' | 'multiple_choice';
    options: { text: string }[];
    required?: boolean;
  }[];
  showStatistics?: boolean;
}

export interface UpdatePollData {
  title?: string;
  description?: string;
  questions?: {
    text: string;
    type: 'single_choice' | 'multiple_choice';
    options: { text: string }[];
    required?: boolean;
  }[];
  showStatistics?: boolean;
}

export interface PollAnswer {
  questionId: string;
  selectedOptions: string[];
}

export interface SubmitPollResponse {
  answers: PollAnswer[];
  orgAttendeeId?: string;
}

export interface PollStatistics {
  pollId: string;
  title: string;
  totalResponses: number;
  status: string;
  showStatistics: boolean;
  questions: {
    id: string;
    text: string;
    type: string;
    totalVotes: number;
    options: {
      id: string;
      text: string;
      votes: number;
      percentage: number;
    }[];
  }[];
}

/**
 * Crear una nueva encuesta
 */
export const createPoll = async (
  orgSlug: string,
  eventSlug: string,
  data: CreatePollData
): Promise<Poll> => {
  const response = await api.post(`/events/${eventSlug}/polls`, data, {
    params: { orgSlug },
  });
  return response.data;
};

/**
 * Obtener todas las encuestas de un evento
 */
export const getEventPolls = async (
  orgSlug: string,
  eventSlug: string
): Promise<Poll[]> => {
  const response = await api.get(`/events/${eventSlug}/polls`, {
    params: { orgSlug },
  });
  return response.data;
};

/**
 * Obtener encuesta activa (para usuarios en attend)
 */
export const getActivePoll = async (
  orgSlug: string,
  eventSlug: string
): Promise<Poll | null> => {
  const response = await api.get(`/events/${eventSlug}/polls/active`, {
    params: { orgSlug },
  });
  return response.data;
};

/**
 * Obtener una encuesta específica
 */
export const getPoll = async (
  orgSlug: string,
  eventSlug: string,
  pollId: string
): Promise<Poll> => {
  const response = await api.get(`/events/${eventSlug}/polls/${pollId}`, {
    params: { orgSlug },
  });
  return response.data;
};

/**
 * Actualizar una encuesta (solo en draft)
 */
export const updatePoll = async (
  orgSlug: string,
  eventSlug: string,
  pollId: string,
  data: UpdatePollData
): Promise<Poll> => {
  const response = await api.put(`/events/${eventSlug}/polls/${pollId}`, data, {
    params: { orgSlug },
  });
  return response.data;
};

/**
 * Cambiar el estado de una encuesta
 */
export const updatePollStatus = async (
  orgSlug: string,
  eventSlug: string,
  pollId: string,
  status: 'draft' | 'published' | 'closed'
): Promise<Poll> => {
  const response = await api.put(
    `/events/${eventSlug}/polls/${pollId}/status`,
    { status },
    { params: { orgSlug } }
  );
  return response.data;
};

/**
 * Mostrar/ocultar estadísticas en tiempo real
 */
export const togglePollStatistics = async (
  orgSlug: string,
  eventSlug: string,
  pollId: string,
  showStatistics: boolean
): Promise<Poll> => {
  const response = await api.put(
    `/events/${eventSlug}/polls/${pollId}/statistics`,
    { showStatistics },
    { params: { orgSlug } }
  );
  return response.data;
};

/**
 * Obtener estadísticas de una encuesta
 */
export const getPollStatistics = async (
  orgSlug: string,
  eventSlug: string,
  pollId: string
): Promise<PollStatistics> => {
  const response = await api.get(
    `/events/${eventSlug}/polls/${pollId}/statistics`,
    { params: { orgSlug } }
  );
  return response.data;
};

/**
 * Verificar si el usuario ya respondió una encuesta
 */
export const checkIfUserResponded = async (
  orgSlug: string,
  eventSlug: string,
  pollId: string,
  orgAttendeeId?: string | null
): Promise<{ hasResponded: boolean }> => {
  const params: Record<string, string> = { orgSlug };
  if (orgAttendeeId) {
    params.orgAttendeeId = orgAttendeeId;
  }
  
  const response = await api.get(
    `/events/${eventSlug}/polls/${pollId}/response/check`,
    { params }
  );
  return response.data;
};

/**
 * Responder una encuesta
 */
export const submitPollResponse = async (
  orgSlug: string,
  eventSlug: string,
  pollId: string,
  data: SubmitPollResponse
): Promise<Poll> => {
  const response = await api.post(
    `/events/${eventSlug}/polls/${pollId}/response`,
    data,
    { params: { orgSlug } }
  );
  return response.data;
};

/**
 * Eliminar una encuesta
 */
export const deletePoll = async (
  orgSlug: string,
  eventSlug: string,
  pollId: string
): Promise<void> => {
  await api.delete(`/events/${eventSlug}/polls/${pollId}`, {
    params: { orgSlug },
  });
};
