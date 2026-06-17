// import { useState, useEffect } from "react";
// import { useParams, useNavigate, Link } from "react-router-dom";
// import {
//   Container,
//   Stack,
//   Text,
//   Button,
//   Group,
//   Loader,
//   Center,
//   Box,
// } from "@mantine/core";
// import { fetchRegistrationForm, fetchOrgBySlug, type Org } from "../../api/orgs";
// import { fetchEventsByOrg, type EventItem } from "../../api/events";
// import type { RegistrationForm } from "../../types";
// import type { FoundRegistration } from "../../api/events";
// import { RegistrationAccessCard } from "../../components/auth/RegistrationAccessCard";
// import { AdvancedRegistrationForm } from "../../components/auth/AdvancedRegistrationForm";
// import { RegistrationVerificationForm } from "../../components/auth/RegistrationVerificationForm";
// import UserSession from "../../components/auth/UserSession";
// import { useAuth } from "../../auth/AuthProvider";

// type FlowStep =
//   | "loading"
//   | "access-options" // Página inicial: Ingresar o Registrarse
//   | "quick-login" // Formulario corto con identificadores
//   | "summary" // Resumen de datos encontrados
//   | "full-registration" // Formulario completo de registro
//   | "update-registration"; // Formulario completo para actualizar

// export default function EventRegistration() {
//   const { slug, eventSlug } = useParams<{ slug: string; eventSlug: string }>();
//   const navigate = useNavigate();
//   const { user } = useAuth();
  
//   const [flowStep, setFlowStep] = useState<FlowStep>("loading");
//   const [org, setOrg] = useState<Org | null>(null);
//   const [event, setEvent] = useState<EventItem | null>(null);
//   const [formConfig, setFormConfig] = useState<RegistrationForm | null>(null);
//   const [foundRegistration, setFoundRegistration] = useState<FoundRegistration | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [autoRegistering, setAutoRegistering] = useState(false);

//   useEffect(() => {
//     const initFlow = async () => {
//       if (!slug || !eventSlug) {
//         setError("Parámetros de URL inválidos");
//         return;
//       }

//       try {
//         setError(null);
        
//         // Cargar datos de organización
//         const orgData = await fetchOrgBySlug(slug);
//         setOrg(orgData);

//         // Cargar evento específico
//         const eventsData = await fetchEventsByOrg(orgData._id);
//         const foundEvent = eventsData.find(e => e.slug === eventSlug || e._id === eventSlug);
        
//         if (!foundEvent) {
//           setError("Evento no encontrado");
//           return;
//         }
//         setEvent(foundEvent);

//         // Cargar configuración del formulario
//         const config = await fetchRegistrationForm(slug);
//         setFormConfig(config);

//         if (!config.enabled) {
//           // Si el registro está deshabilitado, redirigir directamente al evento
//           navigate(`/org/${slug}/event/${eventSlug}/attend`);
//           return;
//         }

//         // AUTO-REGISTRO: Si el usuario tiene sesión y OrgAttendee, intentar auto-registrar
//         let userEmail = user?.email;
//         if (!userEmail && user?.uid) {
//           userEmail = localStorage.getItem(`uid-${user.uid}-email`);
//         }
//         if (!userEmail) {
//           userEmail = localStorage.getItem('user-email');
//         }

//         if (userEmail && user?.uid && foundEvent._id) {
//           console.log("🔍 EventRegistration: Checking for auto-registration", { userEmail, eventId: foundEvent._id });
          
//           try {
//             const { checkIfRegistered, registerToEventWithFirebase } = await import("../../api/events");
//             const result = await checkIfRegistered(foundEvent._id, userEmail);
            
//             // Si ya está registrado, redirigir a attend
//             if (result.isRegistered) {
//               console.log("✅ EventRegistration: Already registered, redirecting to /attend");
//               navigate(`/org/${slug}/event/${eventSlug}/attend`);
//               return;
//             }
            
//             // Si tiene OrgAttendee, auto-registrar
//             if (result.orgAttendee) {
//               console.log("🎯 EventRegistration: Found OrgAttendee, auto-registering");
//               setAutoRegistering(true);
              
//               await registerToEventWithFirebase(foundEvent._id, {
//                 email: userEmail,
//                 name: result.orgAttendee.name,
//                 formData: result.orgAttendee.registrationData,
//                 firebaseUID: user.uid,
//               });
              
//               console.log("✅ EventRegistration: Auto-registration successful");
//               navigate(`/org/${slug}/event/${eventSlug}/attend`);
//               return;
//             }
//           } catch (autoRegError) {
//             console.error("❌ EventRegistration: Auto-registration failed:", autoRegError);
//             // Si falla auto-registro, continuar con flujo manual
//             setAutoRegistering(false);
//           }
//         }

//         // Verificar si tiene campos identificadores configurados
//         const hasIdentifiers = config.fields.some((f) => f.isIdentifier);

//         if (hasIdentifiers) {
//           // Si hay identificadores, ir directo a verificación (quick-login)
//           setFlowStep("quick-login");
//         } else {
//           // Si no hay campos identificadores, mostrar directamente el formulario completo
//           setFlowStep("full-registration");
//         }
//       } catch (error) {
//         console.error("Error initializing registration flow:", error);
//         setError("Error al cargar los datos del evento");
//       }
//     };

//     initFlow();
//   }, [slug, eventSlug, navigate, user]);

//   const handleSuccess = () => {
//     // Redirigir a la página del evento protegida
//     navigate(`/org/${slug}/event/${eventSlug}/attend`);
//   };

//   const handleCancel = () => {
//     // Volver a la página del evento
//     navigate(`/org/${slug}/event/${eventSlug}`);
//   };

//   if (flowStep === "loading" || autoRegistering) {
//     return (
//       <Container size="sm">
//         <Center h={400}>
//           <Stack align="center" gap="lg">
//             <Loader size="lg" />
//             <Text>
//               {autoRegistering 
//                 ? "Registrándote automáticamente al evento..." 
//                 : "Cargando información del evento..."
//               }
//             </Text>
//           </Stack>
//         </Center>
//       </Container>
//     );
//   }

//   if (error || !org || !event || !formConfig) {
//     return (
//       <Container size="sm">
//         <Center h={400}>
//           <Stack align="center" gap="md">
//             <Text c="red" size="lg">{error || "Error al cargar los datos"}</Text>
//             <Group>
//               <Button component={Link} to={`/org/${slug}/event/${eventSlug}`}>
//                 ← Volver al evento
//               </Button>
//               <Button component={Link} to={`/org/${slug}`} variant="light">
//                 Ver organización
//               </Button>
//             </Group>
//           </Stack>
//         </Center>
//       </Container>
//     );
//   }

//   return (
//     <Container size="lg" py="xl">
//       <Stack gap="xl">
//         {/* Header con UserSession */}
//         <Group justify="space-between" align="center">
//           <Button
//             component={Link}
//             to={`/org/${slug}/event/${eventSlug}`}
//             variant="subtle"
//             size="sm"
//             leftSection="←"
//           >
//             {event.title}
//           </Button>
//           <UserSession 
//             eventId={event?._id}
//             orgId={org?._id}
//           />
//         </Group>

//         {/* Header de la página */}
//         {/* <Card shadow="sm" padding="xl" radius="lg" withBorder>
//           <Stack gap="md">
//             <Group justify="space-between" align="flex-start" wrap="nowrap">
//               <Stack gap="sm" style={{ flex: 1 }}>
//                 <Title order={1} size="h2">
//                   {formConfig.title || "Registro al evento"}
//                 </Title>
//                 <Text c="dimmed" size="sm">
//                   {org.name} · {event.title}
//                 </Text>
//                 {formConfig.description && (
//                   <Text size="md" lh={1.5} maw={600}>
//                     {formConfig.description}
//                   </Text>
//                 )}
//               </Stack>
//               <Button 
//                 component={Link} 
//                 to={`/org/${slug}/event/${eventSlug}`}
//                 variant="light"
//                 size="sm"
//               >
//                 ← Volver al evento
//               </Button>
//             </Group>
//           </Stack>
//         </Card> */}

//         {/* Contenido del flujo */}
//         <Box>
//           {/* Página inicial: Ingresar o Registrarse */}
//           {flowStep === "access-options" && (
//             <RegistrationAccessCard
//               formTitle={formConfig.title}
//               formDescription={formConfig.description}
//               onSelectLogin={() => setFlowStep("quick-login")}
//               onSelectRegister={() => setFlowStep("full-registration")}
//               onCancel={handleCancel}
//             />
//           )}

//           {/* Formulario corto: Buscar por identificadores */}
//           {flowStep === "quick-login" && (
//             <Stack gap="md">
//               <RegistrationVerificationForm
//                 orgSlug={slug!}
//                 eventId={event._id}
//                 onVerificationComplete={(result) => {
//                   console.log("🎯 EventRegistration received verification result:", result);
                  
//                   if (result.isRegistered && result.eventUser) {
//                     // Ya registrado - ir directo al evento
//                     console.log("✅ User already registered, redirecting to /attend");
//                     handleSuccess();
//                   } else if (result.orgAttendee && !result.isRegistered) {
//                     // Existe en org pero no en evento - MOSTRAR RESUMEN PRIMERO
//                     console.log("📝 User exists in org, showing summary with option to update");
//                     setFoundRegistration({
//                       found: true,
//                       attendee: result.orgAttendee,
//                     });
//                     setFlowStep("summary"); // Cambio clave: mostrar resumen primero
//                   } else {
//                     // Nuevo usuario - formulario completo
//                     console.log("🆕 New user, showing full registration form");
//                     setFlowStep("full-registration");
//                   }
//                 }}
//                 onNewRegistration={() => setFlowStep("full-registration")}
//               />
//             </Stack>
//           )}

//           {/* Formulario completo: Registro nuevo */}
//           {flowStep === "full-registration" && (
//             <AdvancedRegistrationForm
//               orgSlug={slug!}
//               eventId={event._id}
//               onSuccess={handleSuccess}
//               onCancel={() => {
//                 // Si tiene identificadores, volver al acceso
//                 // Si no, volver al evento
//                 const hasIdentifiers = formConfig?.fields.some((f) => f.isIdentifier);
//                 if (hasIdentifiers) {
//                   setFlowStep("access-options");
//                 } else {
//                   handleCancel();
//                 }
//               }}
//               mode="page"
//             />
//           )}

//           {/* Formulario de actualización: Pre-llenar con datos existentes */}
//           {flowStep === "update-registration" && foundRegistration?.attendee && (
//             <AdvancedRegistrationForm
//               orgSlug={slug!}
//               eventId={event._id}
//               onSuccess={handleSuccess}
//               onCancel={() => setFlowStep("summary")}
//               existingData={{
//                 attendeeId: foundRegistration.attendee._id,
//                 registrationData: foundRegistration.attendee.registrationData,
//               }}
//               mode="page"
//             />
//           )}
//         </Box>
//       </Stack>
//     </Container>
//   );
// }