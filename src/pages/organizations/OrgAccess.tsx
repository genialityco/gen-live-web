// src/pages/org/OrgAccess.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Container,
  Stack,
  Text,
  Button,
  Group,
  Loader,
  Center,
  Box,
  Card,
  TextInput,
  Affix,
} from "@mantine/core";
import {
  useParams,
  useNavigate,
  Link,
  useSearchParams,
} from "react-router-dom";
import {
  fetchRegistrationForm,
  fetchOrgBySlug,
  type Org,
} from "../../api/orgs";
import {
  fetchEventsByOrg,
  type EventItem,
  checkOrgRegistrationByIdentifiers,
  registerToEventWithFirebase,
} from "../../api/events";
import type { RegistrationForm } from "../../types";
import type { FoundRegistration } from "../../api/events";
import { RegistrationAccessCard } from "../../components/auth/RegistrationAccessCard";
import { AdvancedRegistrationForm } from "../../components/auth/AdvancedRegistrationForm";
import { RegistrationVerificationForm } from "../../components/auth/RegistrationVerificationForm";
import { RegistrationSummary } from "../../components/auth/RegistrationSummary";
import UserSession from "../../components/auth/UserSession";
import { useAuth } from "../../auth/AuthProvider";
import { notifications } from "@mantine/notifications";
import { useForm } from "@mantine/form";

// 👇 nuevo import para orgAttendee
import {
  fetchOrgAttendeeByEmail,
  recoverOrgAccess,
  type OrgAttendee,
} from "../../api/org-attendees";

import { normalizeIdentifierValue } from "../../utils/normalizeByType";
import { IconBrandWhatsapp } from "@tabler/icons-react";

type FlowStep =
  | "loading"
  | "access-options"
  | "quick-login"
  | "summary"
  | "full-registration"
  | "update-registration"
  | "org-recovery"
  | "not-found";

type FormValues = Record<string, string>;

export default function OrgAccess() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode");
  const navigate = useNavigate();
  const { user, createAnonymousSession } = useAuth();

  const eventSlugFromQuery = searchParams.get("eventSlug") || undefined;
  const isEventMode = !!eventSlugFromQuery;

  const [flowStep, setFlowStep] = useState<FlowStep>("loading");
  const [org, setOrg] = useState<Org | null>(null);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [formConfig, setFormConfig] = useState<RegistrationForm | null>(null);
  const [foundRegistration, setFoundRegistration] =
    useState<FoundRegistration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRegistering, setAutoRegistering] = useState(false);
  const [orgLoading, setOrgLoading] = useState(false);
  const [, setCreatingEventUser] = useState(false);

  // estado para recuperación org-only
  const [recoveryIdentifierId, setRecoveryIdentifierId] = useState<
    string | null
  >(null);
  const [recoveryIdentifierValue, setRecoveryIdentifierValue] = useState("");
  const [recovering, setRecovering] = useState(false);

  // estado propio para el flujo de actualización ORG-ONLY
  const [orgAttendeeForUpdate, setOrgAttendeeForUpdate] =
    useState<OrgAttendee | null>(null);

  const orgIdentifierForm = useForm<FormValues>({
    initialValues: {},
    validate: {},
  });

  const whatsappHref = "https://wa.me/+573224387523?";

  useEffect(() => {
    const initFlow = async () => {
      if (!slug) {
        setError("Parámetros de URL inválidos");
        return;
      }

      try {
        setError(null);

        const orgData = await fetchOrgBySlug(slug);
        setOrg(orgData);

        const config = await fetchRegistrationForm(slug);
        setFormConfig(config);

        // ================= ORG-ONLY =================
        if (!isEventMode) {
          const hasIdentifiers = config.fields.some((f) => f.isIdentifier);

          // 🔹 Si venimos con ?mode=update, intentamos cargar el OrgAttendee
          if (mode === "update") {
            // obtenemos email del usuario actual / localStorage
            let userEmail = user?.email;
            if (!userEmail && user?.uid) {
              userEmail = localStorage.getItem(`uid-${user.uid}-email`) || null;
            }
            if (!userEmail) {
              userEmail = localStorage.getItem("user-email") || null;
            }

            if (!userEmail) {
              notifications.show({
                color: "red",
                title: "No se pudo cargar tu información",
                message:
                  "No encontramos un correo asociado a tu sesión. Ingresa de nuevo para actualizar tus datos.",
              });
              setFlowStep(
                hasIdentifiers ? "access-options" : "full-registration"
              );
              return;
            }

            try {
              const attendee = await fetchOrgAttendeeByEmail(
                orgData._id,
                userEmail
              );

              if (!attendee) {
                notifications.show({
                  color: "red",
                  title: "Registro no encontrado",
                  message:
                    "No encontramos un registro asociado a tu correo en esta organización.",
                });
                setFlowStep(
                  hasIdentifiers ? "access-options" : "full-registration"
                );
                return;
              }

              console.log(
                "🔎 OrgAccess(org-only): attendee for update:",
                attendee
              );
              setOrgAttendeeForUpdate(attendee);
              setFlowStep("update-registration");
              return;
            } catch (e) {
              console.error(
                "❌ OrgAccess(org-only): error loading attendee for update:",
                e
              );
              notifications.show({
                color: "red",
                title: "Error",
                message:
                  "No se pudo cargar tu información para actualizarla. Intenta de nuevo.",
              });
              setFlowStep(
                hasIdentifiers ? "access-options" : "full-registration"
              );
              return;
            }
          }

          // 🔹 flujo normal (sin modo update)
          setFlowStep(hasIdentifiers ? "access-options" : "full-registration");
          return;
        }

        // ================= EVENT MODE =================
        const eventsData = await fetchEventsByOrg(orgData._id);
        const foundEvent = eventsData.find(
          (e) => e.slug === eventSlugFromQuery || e._id === eventSlugFromQuery
        );

        if (!foundEvent) {
          setError("Evento no encontrado");
          return;
        }
        setEvent(foundEvent);

        if (!config.enabled) {
          navigate(`/org/${slug}/event/${eventSlugFromQuery}/attend`);
          return;
        }

        // Auto-registro
        let userEmail = user?.email;
        if (!userEmail && user?.uid) {
          userEmail = localStorage.getItem(`uid-${user.uid}-email`);
        }
        if (!userEmail) {
          userEmail = localStorage.getItem("user-email");
        }

        if (userEmail && user?.uid && foundEvent._id) {
          console.log(
            "🔍 OrgAccess(EventMode): Checking for auto-registration",
            {
              userEmail,
              eventId: foundEvent._id,
            }
          );

          try {
            const { checkIfRegistered, registerToEventWithFirebase } =
              await import("../../api/events");
            const result = await checkIfRegistered(foundEvent._id, userEmail);

            if (result.isRegistered) {
              console.log(
                "✅ OrgAccess(EventMode): Already registered, redirecting to /attend"
              );
              navigate(`/org/${slug}/event/${eventSlugFromQuery}/attend`);
              return;
            }

            if (result.orgAttendee) {
              console.log(
                "🎯 OrgAccess(EventMode): Found OrgAttendee, auto-registering"
              );
              setAutoRegistering(true);

              await registerToEventWithFirebase(foundEvent._id, {
                email: userEmail,
                name: result.orgAttendee.name,
                formData: result.orgAttendee.registrationData,
                firebaseUID: user.uid,
              });

              console.log(
                "✅ OrgAccess(EventMode): Auto-registration successful"
              );
              navigate(`/org/${slug}/event/${eventSlugFromQuery}/attend`);
              return;
            }
          } catch (autoRegError) {
            console.error(
              "❌ OrgAccess(EventMode): Auto-registration failed:",
              autoRegError
            );
            setAutoRegistering(false);
          }
        }

        const hasIdentifiers = config.fields.some((f) => f.isIdentifier);
        setFlowStep(hasIdentifiers ? "access-options" : "full-registration");
      } catch (e) {
        console.error("Error initializing OrgAccess flow:", e);
        setError("Error al cargar los datos");
      }
    };

    initFlow();
  }, [slug, eventSlugFromQuery, isEventMode, navigate, user, mode]);

  useEffect(() => {
    if (!formConfig) return;
    if (isEventMode) return;

    const identifierFields =
      formConfig.fields?.filter((f) => f.isIdentifier) || [];

    const initialValues: FormValues = {};
    identifierFields.forEach((field) => {
      initialValues[field.id] = "";
    });

    orgIdentifierForm.setInitialValues(initialValues);
    orgIdentifierForm.setValues(initialValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formConfig, isEventMode]);

  const handleSuccessEventMode = () => {
    navigate(`/org/${slug}/event/${eventSlugFromQuery}/attend`);
  };

  const handleCancelEventMode = () => {
    navigate(`/org/${slug}/event/${eventSlugFromQuery}`);
  };

  const extractEmailFromOrgAttendee = (
    orgAttendee: any,
    fallbackEmail?: string
  ): string | null => {
    if (!orgAttendee) return fallbackEmail || null;

    // 1) Prioridad: campo raíz del esquema
    if (orgAttendee.email && typeof orgAttendee.email === "string") {
      return orgAttendee.email;
    }

    const data = orgAttendee.registrationData || {};

    // 2) email_system
    if (data.email_system && typeof data.email_system === "string") {
      return data.email_system;
    }

    // 3) email plano
    if (data.email && typeof data.email === "string") {
      return data.email;
    }

    // 4) cualquier valor con @
    for (const value of Object.values(data)) {
      if (typeof value === "string" && value.includes("@")) {
        return value;
      }
    }

    return fallbackEmail || null;
  };

  const handleOrgOnlyVerify = async (values: FormValues) => {
    try {
      if (!org) {
        notifications.show({
          color: "red",
          title: "Error",
          message: "Organización no cargada.",
        });
        return;
      }

      setOrgLoading(true);
      console.log("🔍 OrgAccess(org-only): verifying identifiers", values);

      const result = await checkOrgRegistrationByIdentifiers(org._id, values);

      // 🔹 Si no se encontró, diferenciamos casos
      if (!result || !result.found || !result.orgAttendee) {
        // limpiar errores previos
        Object.keys(values).forEach((field) =>
          orgIdentifierForm.clearFieldError(field)
        );

        if (result?.reason === "USER_NOT_FOUND") {
          notifications.show({
            color: "red",
            title: "Usuario no encontrado",
            message:
              "No encontramos ningún registro con estos datos en esta organización.",
          });
        } else if (result?.reason === "INVALID_FIELDS") {
          if (result.mismatched && result.mismatched.length > 0) {
            result.mismatched.forEach((field) => {
              if (field in values) {
                orgIdentifierForm.setFieldError(
                  field,
                  "Este dato no coincide con nuestro registro"
                );
              }
            });
          }

          notifications.show({
            color: "orange",
            title: "Datos incorrectos",
            message:
              "Algunos de los datos ingresados no coinciden con nuestro registro. Revisa la información e inténtalo nuevamente.",
          });
        } else {
          notifications.show({
            color: "red",
            title: "No encontrado",
            message:
              result?.message ??
              "No encontramos un registro con esos datos en esta organización.",
          });
        }

        return;
      }

      // 🔹 Si sí se encontró, seguimos como ya lo tenías
      const userEmail =
        extractEmailFromOrgAttendee(result.orgAttendee) ||
        (Object.values(values).find(
          (v) => typeof v === "string" && v.includes("@")
        ) as string | undefined) ||
        null;

      if (!userEmail) {
        console.error("❌ OrgAccess(org-only): no email found for attendee");
        notifications.show({
          color: "red",
          title: "Error",
          message:
            "No se pudo identificar tu correo electrónico. Contacta al administrador.",
        });
        return;
      }

      console.log(
        "✅ OrgAccess(org-only): attendee found, creating anonymous session for",
        userEmail
      );

      const uid = await createAnonymousSession(userEmail);
      localStorage.setItem("user-email", userEmail);
      localStorage.setItem(`uid-${uid}-email`, userEmail);

      notifications.show({
        color: "green",
        title: "Acceso listo",
        message: "Validamos tu registro en la organización.",
      });

      navigate(`/org/${slug}`);
    } catch (error) {
      console.error("Error verifying org-only identifiers:", error);
      notifications.show({
        color: "red",
        title: "Error",
        message: "No se pudo verificar tu registro. Intenta de nuevo.",
      });
    } finally {
      setOrgLoading(false);
    }
  };

  const handleOrgRecoverySubmit = async () => {
    if (!org) {
      notifications.show({
        color: "red",
        title: "Error",
        message: "Organización no cargada.",
      });
      return;
    }

    if (!recoveryIdentifierId || !recoveryIdentifierValue.trim()) {
      notifications.show({
        color: "orange",
        title: "Dato requerido",
        message:
          "Selecciona el tipo de dato e ingresa un valor para enviarte el recordatorio.",
      });
      return;
    }

    const identifierFields =
      formConfig?.fields?.filter((f) => f.isIdentifier) || [];

    const fieldDef = identifierFields.find(
      (f) => f.id === recoveryIdentifierId
    );

    if (!fieldDef) {
      notifications.show({
        color: "red",
        title: "Error",
        message: "El tipo de dato seleccionado no es válido.",
      });
      return;
    }

    const normalized = normalizeIdentifierValue(
      recoveryIdentifierValue,
      fieldDef.type
    );

    // Validación básica para number
    if (fieldDef.type === "number" && Number.isNaN(normalized)) {
      notifications.show({
        color: "orange",
        title: "Dato inválido",
        message: `El valor ingresado para "${fieldDef.label}" debe ser numérico.`,
      });
      return;
    }

    setRecovering(true);
    try {
      await recoverOrgAccess(org._id, {
        [recoveryIdentifierId]: normalized,
      });

      notifications.show({
        color: "green",
        title: "Si encontramos un registro...",
        message:
          "Te enviaremos un correo con la información para que recuerdes con qué datos te registraste.",
      });

      setFlowStep("access-options");
    } catch (error) {
      console.error("❌ Error en recuperación org-only:", error);
      notifications.show({
        color: "red",
        title: "Error",
        message:
          "No se pudo procesar tu solicitud de recuperación. Intenta de nuevo más tarde.",
      });
    } finally {
      setRecovering(false);
    }
  };

  // Handler para continuar desde el resumen (EVENT MODE):
  // crea el EventUser a partir del OrgAttendee y luego navega a /attend
  // dentro de OrgAccess.tsx

  const handleContinueFromSummary = async () => {
    if (!foundRegistration?.attendee) {
      handleSuccessEventMode();
      return;
    }

    if (!event) {
      handleSuccessEventMode();
      return;
    }

    try {
      setCreatingEventUser(true);

      const attendee = foundRegistration.attendee;

      // 1) Sacar email del OrgAttendee
      const email =
        extractEmailFromOrgAttendee(attendee) ||
        user?.email ||
        (user?.uid ? localStorage.getItem(`uid-${user.uid}-email`) : null) ||
        localStorage.getItem("user-email") ||
        null;

      if (!email) {
        console.error(
          "❌ handleContinueFromSummary: no email found for attendee"
        );
        notifications.show({
          color: "red",
          title: "Error",
          message:
            "No se pudo identificar tu correo electrónico. Contacta al organizador.",
        });
        return;
      }

      // 2) Asegurar sesión anónima y persistir email
      let firebaseUID = user?.uid;

      if (!firebaseUID) {
        console.log(
          "🔐 handleContinueFromSummary: creating anonymous session for",
          email
        );
        firebaseUID = await createAnonymousSession(email);
        localStorage.setItem("user-email", email);
        localStorage.setItem(`uid-${firebaseUID}-email`, email);
      }

      // fallback para EventAttend
      localStorage.setItem("last-registered-email", email);

      // 3) (opcional pero recomendado) comprobar si YA está registrado
      try {
        const { checkIfRegistered } = await import("../../api/events");
        const status = await checkIfRegistered(event._id, email);

        if (status.isRegistered) {
          console.log(
            "✅ handleContinueFromSummary: EventUser ya existe, redirigiendo a /attend"
          );
          handleSuccessEventMode();
          return;
        }
      } catch (checkError) {
        console.warn(
          "⚠️ handleContinueFromSummary: error al verificar si ya estaba registrado",
          checkError
        );
        // Si falla el check, seguimos igual y tratamos de registrarlo
      }
      console.log("attendee data:", attendee);
      // 4) Crear/actualizar el EventUser usando la MISMA ruta que el auto-registro
      await registerToEventWithFirebase(event._id, {
        email,
        name: attendee.name, // o intenta sacar el nombre de registrationData si ahí lo guardas
        formData: attendee.registrationData,
        firebaseUID,
      });

      notifications.show({
        color: "green",
        title: "Registro completado",
        message:
          "Tu registro a este evento está listo. Te estamos llevando al evento.",
      });

      // 5) Ir al attend
      handleSuccessEventMode();
    } catch (err: any) {
      console.error("❌ Error creando EventUser desde summary:", err);

      const status = err?.response?.status;
      const message: string | undefined = err?.response?.data?.message;

      // Por si tu backend responde algo tipo "ya está registrado" con 400/409
      if (
        status === 409 ||
        (typeof message === "string" &&
          message.toLowerCase().includes("ya está registrado"))
      ) {
        console.warn(
          "⚠️ handleContinueFromSummary: EventUser ya existía, redirigiendo igualmente a /attend"
        );
        handleSuccessEventMode();
        return;
      }

      notifications.show({
        color: "red",
        title: "Error",
        message:
          "No se pudo completar tu registro al evento. Intenta nuevamente o contacta al organizador.",
      });
    } finally {
      setCreatingEventUser(false);
    }
  };

  // ========================= ORG-ONLY =========================
  if (!isEventMode) {
    if (flowStep === "loading") {
      return (
        <Container size="sm">
          <Center h={400}>
            <Stack align="center" gap="lg">
              <Loader size="lg" />
              <Text>Cargando información de la organización...</Text>
            </Stack>
          </Center>
        </Container>
      );
    }

    if (error || !org || !formConfig) {
      return (
        <Container size="sm">
          <Center h={400}>
            <Stack align="center" gap="md">
              <Text c="red" size="lg">
                {error || "Error al cargar la organización"}
              </Text>
              <Button component={Link} to="/organizations">
                ← Ver organizaciones
              </Button>
            </Stack>
          </Center>
        </Container>
      );
    }

    const identifierFields =
      formConfig.fields?.filter((f) => f.isIdentifier) || [];

    return (
      <Container size="sm" py="xl">
        <Stack gap="xl">
          <Group justify="space-between" align="center">
            <Button
              component={Link}
              to={`/org/${slug}`}
              variant="subtle"
              size="sm"
              leftSection="←"
            >
              {org.name}
            </Button>
            <UserSession orgId={org._id} />
          </Group>

          {identifierFields.length > 0 ? (
            <Box>
              {/* 🔹 Modo actualización ORG-ONLY */}
              {flowStep === "update-registration" && orgAttendeeForUpdate && (
                <AdvancedRegistrationForm
                  orgSlug={slug!}
                  orgId={org._id}
                  registrationScope="org-only"
                  onSuccess={() => {
                    notifications.show({
                      color: "green",
                      title: "Datos actualizados",
                      message: "Tu información se actualizó correctamente.",
                    });
                    navigate(`/org/${slug}`);
                  }}
                  onCancel={() => navigate(`/org/${slug}`)}
                  existingData={{
                    attendeeId: orgAttendeeForUpdate._id,
                    registrationData:
                      orgAttendeeForUpdate.registrationData ?? {},
                  }}
                  mode="page"
                />
              )}

              {flowStep === "access-options" && (
                <RegistrationAccessCard
                  onSelectLogin={() => setFlowStep("quick-login")}
                  onSelectRegister={() => setFlowStep("full-registration")}
                  onCancel={() => navigate(`/org/${slug}`)}
                />
              )}

              {flowStep === "quick-login" && (
                <Card shadow="md" padding="xl" radius="lg" withBorder>
                  <form
                    onSubmit={orgIdentifierForm.onSubmit(handleOrgOnlyVerify)}
                  >
                    <Stack gap="lg">
                      <Stack gap="xs">
                        <Text fw={600} size="lg">
                          Ingresar a la organización
                        </Text>
                        <Text size="sm" c="dimmed">
                          Ingresa tus datos identificadores para verificar si ya
                          estás registrado.
                        </Text>
                      </Stack>

                      {identifierFields.map((field) => (
                        <TextInput
                          key={field.id}
                          label={field.label}
                          placeholder={field.placeholder}
                          type={
                            field.type === "email"
                              ? "email"
                              : field.type === "tel"
                              ? "tel"
                              : "text"
                          }
                          required={field.required}
                          {...orgIdentifierForm.getInputProps(field.id)}
                        />
                      ))}

                      <Text size="xs" c="dimmed">
                        ¿No recuerdas con qué datos te registraste?{" "}
                        <Button
                          variant="subtle"
                          size="xs"
                          px={0}
                          onClick={() => setFlowStep("org-recovery")}
                        >
                          Recordar mis datos
                        </Button>
                      </Text>

                      <Group justify="space-between" mt="md">
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => setFlowStep("access-options")}
                        >
                          ← Volver
                        </Button>
                        <Button type="submit" loading={orgLoading}>
                          Ingresar
                        </Button>
                      </Group>
                    </Stack>
                  </form>
                </Card>
              )}

              {flowStep === "org-recovery" && (
                <Card shadow="md" padding="xl" radius="lg" withBorder>
                  <Stack gap="md">
                    <Stack gap={4}>
                      <Text fw={600} size="lg">
                        Recordar mis datos de acceso
                      </Text>
                      <Text size="sm" c="dimmed">
                        Si ya te registraste antes pero no recuerdas con qué
                        datos, podemos enviarte un correo con un recordatorio.
                        <br />
                        Solo dinos qué tipo de dato recuerdas (por ejemplo, tu
                        correo o documento) y escríbelo a continuación.
                      </Text>
                    </Stack>

                    <Stack gap="xs">
                      <Text size="sm" fw={500}>
                        ¿Qué dato recuerdas?
                      </Text>
                      <select
                        value={recoveryIdentifierId ?? ""}
                        onChange={(e) =>
                          setRecoveryIdentifierId(e.target.value || null)
                        }
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #ced4da",
                          fontSize: 14,
                        }}
                      >
                        <option value="">Selecciona un tipo de dato</option>
                        {identifierFields.map((field) => (
                          <option key={field.id} value={field.id}>
                            {field.label}
                          </option>
                        ))}
                      </select>

                      <TextInput
                        mt="xs"
                        label="Valor del dato"
                        placeholder="Escribe aquí tu correo, documento u otro identificador"
                        value={recoveryIdentifierValue}
                        onChange={(e) =>
                          setRecoveryIdentifierValue(e.currentTarget.value)
                        }
                      />
                    </Stack>

                    <Group justify="space-between" mt="md">
                      <Button
                        variant="subtle"
                        size="sm"
                        onClick={() => setFlowStep("quick-login")}
                      >
                        ← Volver a ingresar
                      </Button>

                      <Button
                        size="sm"
                        loading={recovering}
                        onClick={handleOrgRecoverySubmit}
                      >
                        Enviarme un recordatorio
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              )}

              {flowStep === "full-registration" && (
                <AdvancedRegistrationForm
                  orgSlug={slug!}
                  orgId={org._id}
                  registrationScope="org-only"
                  onSuccess={() => {
                    notifications.show({
                      color: "green",
                      title: "Registro completado",
                      message:
                        "Tu registro en la organización se guardó correctamente.",
                    });
                    navigate(`/org/${slug}`);
                  }}
                  onCancel={() => {
                    const hasIdentifiers = formConfig.fields.some(
                      (f) => f.isIdentifier
                    );
                    if (hasIdentifiers) {
                      setFlowStep("access-options");
                    } else {
                      navigate(`/org/${slug}`);
                    }
                  }}
                  mode="page"
                />
              )}
            </Box>
          ) : (
            <AdvancedRegistrationForm
              orgSlug={slug!}
              orgId={org._id}
              registrationScope="org-only"
              onSuccess={() => {
                notifications.show({
                  color: "green",
                  title: "Registro completado",
                  message:
                    "Tu registro en la organización se guardó correctamente.",
                });
                navigate(`/org/${slug}`);
              }}
              onCancel={() => navigate(`/org/${slug}`)}
              mode="page"
            />
          )}
        </Stack>
      </Container>
    );
  }

  // ========================= EVENT MODE =========================

  if (flowStep === "loading" || autoRegistering) {
    return (
      <Container size="sm">
        <Center h={400}>
          <Stack align="center" gap="lg">
            <Loader size="lg" />
            <Text>
              {autoRegistering
                ? "Registrándote automáticamente al evento..."
                : "Cargando información del evento..."}
            </Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  if (error || !org || !event || !formConfig) {
    return (
      <Container size="sm">
        <Center h={400}>
          <Stack align="center" gap="md">
            <Text c="red" size="lg">
              {error || "Error al cargar los datos"}
            </Text>
            <Group>
              <Button
                component={Link}
                to={`/org/${slug}/event/${eventSlugFromQuery}`}
              >
                ← Volver al evento
              </Button>
              <Button component={Link} to={`/org/${slug}`} variant="light">
                Ver organización
              </Button>
            </Group>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Button
            component={Link}
            to={`/org/${slug}/event/${eventSlugFromQuery}`}
            variant="subtle"
            size="sm"
            leftSection="←"
          >
            {event.title}
          </Button>
          <UserSession eventId={event?._id} orgId={org?._id} />
        </Group>

        <Box>
          {flowStep === "access-options" && (
            <RegistrationAccessCard
              formTitle={formConfig.title}
              formDescription={formConfig.description}
              onSelectLogin={() => setFlowStep("quick-login")}
              onSelectRegister={() => setFlowStep("full-registration")}
              onCancel={handleCancelEventMode}
            />
          )}

          {flowStep === "quick-login" && (
            <>
              <Stack gap="md">
                <RegistrationVerificationForm
                  orgSlug={slug!}
                  orgId={org._id}
                  eventId={event._id}
                  onVerificationComplete={(result: any) => {
                    console.log(
                      "🎯 OrgAccess(EventMode) verification result:",
                      result
                    );

                    // 1) Campos inválidos: nos quedamos en quick-login
                    if (result.status === "INVALID_FIELDS") {
                      notifications.show({
                        color: "orange",
                        title: "Datos incorrectos",
                        message:
                          result.message ||
                          "Algunos de los datos ingresados no coinciden con nuestro registro. Revisa la información e inténtalo nuevamente.",
                      });
                      // 👇 IMPORTANTE: NO cambiamos el flowStep,
                      // así el usuario sigue viendo el formulario de verificación.
                      return;
                    }

                    // 2) Usuario no encontrado explícitamente
                    if (result.status === "USER_NOT_FOUND") {
                      notifications.show({
                        color: "red",
                        title: "Usuario no encontrado",
                        message:
                          result.message ||
                          "No encontramos ningún registro con estos datos en esta organización.",
                      });

                      // Aquí decides si lo mandas a registro completo o lo dejas en quick-login.
                      // Si quieres comportamiento igual al org-only, puedes dejar al usuario decidir
                      // con el botón de "registrarme". Si quieres adelantarlo:
                      setFlowStep("full-registration");
                      return;
                    }

                    // 3) Ya registrado al evento
                    if (result.isRegistered && result.eventUser) {
                      console.log(
                        "✅ User already registered, redirecting to /attend"
                      );
                      handleSuccessEventMode();
                      return;
                    }

                    // 4) Existe en la organización pero no en el evento
                    if (result.orgAttendee && !result.isRegistered) {
                      console.log(
                        "📝 User exists in org, showing summary with option to update"
                      );
                      setFoundRegistration({
                        found: true,
                        attendee: result.orgAttendee,
                      });
                      setFlowStep("summary");
                      return;
                    }

                    // 5) Caso residual: nuevo de verdad
                    console.log("🆕 New user, showing full registration form");
                    setFlowStep("full-registration");
                  }}
                  onNewRegistration={() => setFlowStep("full-registration")}
                />
              </Stack>

              <Affix position={{ bottom: 20, right: 20 }}>
                <Button
                  component="a"
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  leftSection={<IconBrandWhatsapp size={18} />}
                  color="green"
                  radius="xl"
                  size="md"
                  variant="filled"
                  styles={{
                    root: {
                      boxShadow: "0 10px 24px rgba(0,0,0,.12)",
                      paddingInline: 16,
                    },
                  }}
                >
                  Soporte Técnico
                </Button>
              </Affix>
            </>
          )}

          {flowStep === "summary" && foundRegistration && (
            <RegistrationSummary
              registration={foundRegistration}
              formConfig={formConfig}
              onContinueToEvent={handleContinueFromSummary}
              onUpdateInfo={() => setFlowStep("update-registration")}
            />
          )}

          {flowStep === "full-registration" && (
            <>
              <AdvancedRegistrationForm
                orgSlug={slug!}
                orgId={org._id}
                eventId={event._id}
                registrationScope="org+event"
                onSuccess={handleSuccessEventMode}
                onCancel={() => {
                  const hasIdentifiers = formConfig?.fields.some(
                    (f) => f.isIdentifier
                  );
                  if (hasIdentifiers) {
                    setFlowStep("access-options");
                  } else {
                    handleCancelEventMode();
                  }
                }}
                mode="page"
              />
              <Affix position={{ bottom: 20, right: 20 }}>
                <Button
                  component="a"
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  leftSection={<IconBrandWhatsapp size={18} />}
                  color="green"
                  radius="xl"
                  size="md"
                  variant="filled"
                  styles={{
                    root: {
                      boxShadow: "0 10px 24px rgba(0,0,0,.12)",
                      paddingInline: 16,
                    },
                  }}
                >
                  Soporte Técnico
                </Button>
              </Affix>
            </>
          )}

          {flowStep === "update-registration" &&
            foundRegistration?.attendee && (
              <AdvancedRegistrationForm
                orgSlug={slug!}
                orgId={org._id}
                eventId={event._id}
                registrationScope="org+event"
                onSuccess={handleSuccessEventMode}
                onCancel={() => setFlowStep("summary")}
                existingData={{
                  attendeeId: foundRegistration.attendee._id,
                  registrationData: foundRegistration.attendee.registrationData,
                }}
                mode="page"
              />
            )}
        </Box>
      </Stack>
    </Container>
  );
}
