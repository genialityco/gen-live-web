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
  type OrgAttendee,
} from "../../api/org-attendees";

// 👇 import para crear EventUser desde OrgAttendee
import { registerEventUserFromOrgAttendee } from "../../api/event-users";

type FlowStep =
  | "loading"
  | "access-options"
  | "quick-login"
  | "summary"
  | "full-registration"
  | "update-registration";

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

  // 👇 estado propio para el flujo de actualización ORG-ONLY
  const [orgAttendeeForUpdate, setOrgAttendeeForUpdate] =
    useState<OrgAttendee | null>(null);

  const orgIdentifierForm = useForm<FormValues>({
    initialValues: {},
    validate: {},
  });

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

      // 1) Sacar email del OrgAttendee (usando helper que ya tienes)
      const email =
        extractEmailFromOrgAttendee(attendee) ||
        user?.email ||
        localStorage.getItem(user?.uid ? `uid-${user.uid}-email` : "") ||
        localStorage.getItem("user-email") ||
        null;

      if (!email) {
        console.warn(
          "⚠️ handleContinueFromSummary: no email found for attendee, proceeding without email"
        );
      }

      // 2) Asegurar sesión anónima en Firebase y persistir email
      let firebaseUID = user?.uid;

      if (!firebaseUID && email) {
        firebaseUID = await createAnonymousSession(email);
        localStorage.setItem("user-email", email);
        localStorage.setItem(`uid-${firebaseUID}-email`, email);
      }

      // 3) Guardar fallback específico para EventAttend (prioridad 3)
      if (email) {
        localStorage.setItem("last-registered-email", email);
      }

      // 4) Crear el EventUser a partir del OrgAttendee
      await registerEventUserFromOrgAttendee(
        attendee._id,
        event._id,
        firebaseUID
      );

      notifications.show({
        color: "green",
        title: "Registro completado",
        message:
          "Tu registro a este evento está listo. Te estamos llevando al evento.",
      });

      // 5) Ahora sí, ir a /attend
      handleSuccessEventMode();
    } catch (err) {
      console.error("❌ Error creando EventUser desde summary:", err);
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
            <Stack gap="md">
              <RegistrationVerificationForm
                orgSlug={slug!}
                eventId={event._id}
                onVerificationComplete={(result) => {
                  console.log(
                    "🎯 OrgAccess(EventMode) verification result:",
                    result
                  );

                  if (result.isRegistered && result.eventUser) {
                    console.log(
                      "✅ User already registered, redirecting to /attend"
                    );
                    handleSuccessEventMode();
                  } else if (result.orgAttendee && !result.isRegistered) {
                    console.log(
                      "📝 User exists in org, showing summary with option to update"
                    );
                    setFoundRegistration({
                      found: true,
                      attendee: result.orgAttendee,
                    });
                    setFlowStep("summary");
                  } else {
                    console.log("🆕 New user, showing full registration form");
                    setFlowStep("full-registration");
                  }
                }}
                onNewRegistration={() => setFlowStep("full-registration")}
              />
            </Stack>
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
