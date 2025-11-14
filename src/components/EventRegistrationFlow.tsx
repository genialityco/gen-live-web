import { useState, useEffect } from "react";
import { fetchRegistrationForm } from "../api/orgs";
import type { RegistrationForm } from "../types";
import type { FoundRegistration } from "../api/events";
import { RegistrationAccessModal } from "./RegistrationAccessModal";
import { QuickLoginForm } from "./QuickLoginForm";
import { RegistrationSummary } from "./RegistrationSummary";
import { AdvancedRegistrationFormModal } from "./AdvancedRegistrationFormModal";

interface EventRegistrationFlowProps {
  orgSlug: string;
  eventId: string;
  onSuccess: () => void;
  onClose?: () => void; // Callback cuando el usuario cierra el flujo sin completar
}

type FlowState =
  | "loading"
  | "access-options" // Modal inicial: Ingresar o Registrarse
  | "quick-login" // Formulario corto con identificadores
  | "summary" // Resumen de datos encontrados
  | "full-registration" // Formulario completo de registro
  | "update-registration" // Formulario completo para actualizar
  | "completed";

export function EventRegistrationFlow({
  orgSlug,
  eventId,
  onSuccess,
  onClose,
}: EventRegistrationFlowProps) {
  const [flowState, setFlowState] = useState<FlowState>("loading");
  const [formConfig, setFormConfig] = useState<RegistrationForm | null>(null);
  const [foundRegistration, setFoundRegistration] =
    useState<FoundRegistration | null>(null);

  useEffect(() => {
    const initFlow = async () => {
      try {
        const config = await fetchRegistrationForm(orgSlug);
        setFormConfig(config);

        if (!config.enabled) {
          onSuccess();
          return;
        }

        // Verificar si tiene campos identificadores configurados
        const hasIdentifiers = config.fields.some((f) => f.isIdentifier);

        if (hasIdentifiers) {
          // Mostrar modal de opciones
          setFlowState("access-options");
        } else {
          // Si no hay campos identificadores, mostrar directamente el formulario completo
          setFlowState("full-registration");
        }
      } catch (error) {
        console.error("Error initializing registration flow:", error);
        setFlowState("full-registration");
      }
    };

    initFlow();
  }, [orgSlug, eventId, onSuccess]);

  // Reiniciar el flujo si se completa y luego se intenta acceder de nuevo
  useEffect(() => {
    if (flowState === "completed") {
      // Pequeño delay para permitir que se cierre el último modal
      const timer = setTimeout(() => {
        setFlowState("loading");
        setFoundRegistration(null);
        // Re-ejecutar initFlow
        const reinitFlow = async () => {
          try {
            const config = await fetchRegistrationForm(orgSlug);
            setFormConfig(config);
            
            if (!config.enabled) {
              return;
            }
            
            const hasIdentifiers = config.fields.some((f) => f.isIdentifier);
            if (hasIdentifiers) {
              setFlowState("access-options");
            } else {
              setFlowState("full-registration");
            }
          } catch (error) {
            console.error("Error reinitializing flow:", error);
            setFlowState("full-registration");
          }
        };
        reinitFlow();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [flowState, orgSlug]);

  if (!formConfig || flowState === "loading") {
    return null;
  }

  return (
    <>
      {/* Modal inicial: Ingresar o Registrarse */}
      <RegistrationAccessModal
        opened={flowState === "access-options"}
        onClose={() => {
          setFlowState("loading");
          setFoundRegistration(null);
          // Notificar al padre que se cerró el flujo
          onClose?.();
        }}
        formTitle={formConfig.title}
        formDescription={formConfig.description}
        onSelectLogin={() => setFlowState("quick-login")}
        onSelectRegister={() => setFlowState("full-registration")}
      />

      {/* Formulario corto: Buscar por identificadores */}
      <QuickLoginForm
        opened={flowState === "quick-login"}
        onClose={() => setFlowState("access-options")}
        eventId={eventId}
        formConfig={formConfig}
        onFound={(registration) => {
          setFoundRegistration(registration);
          setFlowState("summary");
        }}
        onNotFound={() => setFlowState("full-registration")}
      />

      {/* Resumen de registro encontrado */}
      {foundRegistration && (
        <RegistrationSummary
          opened={flowState === "summary"}
          onClose={() => setFlowState("access-options")}
          registration={foundRegistration}
          formConfig={formConfig}
          onContinueToEvent={() => {
            setFlowState("completed");
            onSuccess();
          }}
          onUpdateInfo={() => setFlowState("update-registration")}
        />
      )}

      {/* Formulario completo: Registro nuevo */}
      {flowState === "full-registration" && (
        <AdvancedRegistrationFormModal
          orgSlug={orgSlug}
          eventId={eventId}
          onSuccess={() => {
            setFlowState("completed");
            onSuccess();
          }}
          onCancel={() => {
            // Si tiene identificadores, volver al modal de opciones
            // Si no, cerrar todo el flujo
            const hasIdentifiers = formConfig?.fields.some((f) => f.isIdentifier);
            if (hasIdentifiers) {
              setFlowState("access-options");
            } else {
              onClose?.();
            }
          }}
        />
      )}

      {/* Formulario de actualización: Pre-llenar con datos existentes */}
      {flowState === "update-registration" && foundRegistration?.attendee && (
        <AdvancedRegistrationFormModal
          orgSlug={orgSlug}
          eventId={eventId}
          onSuccess={() => {
            setFlowState("completed");
            onSuccess();
          }}
          onCancel={() => {
            // Volver al resumen
            setFlowState("summary");
          }}
          existingData={{
            attendeeId: foundRegistration.attendee._id,
            registrationData: foundRegistration.attendee.registrationData,
          }}
        />
      )}
    </>
  );
}
