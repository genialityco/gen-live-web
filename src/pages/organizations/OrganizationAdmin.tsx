import { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Title, Loader, Center, Container, Paper, Alert } from "@mantine/core";
import { fetchOrgBySlugForAdmin, type Org } from "../../api/orgs";
import { AdminLayout } from "../../components/common";
import { CreateOrganizationForm } from "../../components/organizations";
import AdminDashboardView from "./AdminDashboardView";
import AdminEventsView from "./AdminEventsView";
import AdminAttendeesView from "./AdminAttendeesView";
import BrandingSettings from "../../components/organizations/BrandingSettings";
import RegistrationFormBuilder from "../../components/organizations/RegistrationFormBuilder";

export default function OrganizationAdmin() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modo creación cuando no hay slug
  const isCreateMode = !slug;

  const loadOrganizationData = async () => {
    // Si no hay slug, estamos en modo creación
    if (!slug) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const orgData = await fetchOrgBySlugForAdmin(slug);
      setOrg(orgData);
    } catch (err) {
      console.error("Error loading organization data:", err);
      setError("No se pudo cargar la organización o no tienes permisos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizationData();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (org) {
      document.title = `Administrador ${org.name}`;
    }
    return () => {
      document.title = "Gen Live";
    };
  }, [org]);
  // Determinar qué vista mostrar basado en la ruta
  const getCurrentView = () => {
    if (!org) return null;

    const path = location.pathname;
    if (path.endsWith("/events")) {
      return <AdminEventsView orgId={org._id} />;
    } else if (path.endsWith("/attendees")) {
      return <AdminAttendeesView orgId={org._id} orgName={org.name} />;
    } else if (path.endsWith("/registration-form")) {
      return (
        <RegistrationFormBuilder org={org} onUpdate={loadOrganizationData} />
      );
    } else if (path.endsWith("/settings")) {
      return <BrandingSettings org={org} onUpdate={loadOrganizationData} />;
    } else {
      // Vista por defecto (dashboard)
      return <AdminDashboardView orgId={org._id} orgName={org.name} />;
    }
  };

  // Loading state
  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Center>
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container size="lg" py="xl">
        <Alert variant="filled" color="red" title="Error">
          {error}
        </Alert>
      </Container>
    );
  }

  // Modo creación (cuando no hay slug)
  if (isCreateMode) {
    return (
      <Container size="md" py="xl">
        <Paper p="xl" withBorder>
          <Title order={1} mb="xl" ta="center">
            Crear Nueva Organización
          </Title>
          <CreateOrganizationForm
            onCreated={(newOrg) => {
              if (newOrg) {
                window.location.href = `/org/${newOrg.domainSlug}/admin`;
              }
            }}
          />
        </Paper>
      </Container>
    );
  }

  // Org no encontrada
  if (!org) {
    return (
      <Container size="lg" py="xl">
        <Alert variant="filled" color="yellow" title="Advertencia">
          Organización no encontrada
        </Alert>
      </Container>
    );
  }

  // Render con el nuevo AdminLayout
  return <AdminLayout org={org}>{getCurrentView()}</AdminLayout>;
}
