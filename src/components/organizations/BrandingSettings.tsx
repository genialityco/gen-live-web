/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Stack,
  Title,
  Card,
  Group,
  Text,
  Button,
  Tabs,
  ColorInput,
  Switch,
  FileInput,
  Image,
  Alert,
  Loader,
  ActionIcon,
  Divider,
  TextInput,
  Textarea,
  Modal,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconTrash, IconAlertCircle } from "@tabler/icons-react";
import {
  type Org,
  type BrandingConfig,
  updateOrgBranding,
  uploadBrandingImage,
  updateOrganization,
  deleteOrg,
} from "../../api/orgs";

interface BrandingSettingsProps {
  org: Org;
  onUpdate: () => void;
}

export default function BrandingSettings({
  org,
  onUpdate,
}: BrandingSettingsProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [branding, setBranding] = useState<BrandingConfig>(org.branding || {});
  const [description, setDescription] = useState(org.description || "");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const updateField = <K extends keyof BrandingConfig>(
    field: K,
    value: BrandingConfig[K]
  ) => {
    setBranding((prev) => ({ ...prev, [field]: value }));
  };

  const updateNestedField = <K extends keyof BrandingConfig>(
    parent: K,
    field: string,
    value: any
  ) => {
    setBranding((prev) => ({
      ...prev,
      [parent]: {
        ...(prev[parent] as any),
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Actualizar descripción si cambió
      if (description !== org.description) {
        await updateOrganization(org.domainSlug, { description });
      }
      
      // Actualizar branding
      await updateOrgBranding(org.domainSlug, branding);
      
      notifications.show({
        title: "Éxito",
        message: "Configuración actualizada correctamente",
        color: "green",
      });
      onUpdate();
    } catch (error) {
      console.error(error);

      notifications.show({
        title: "Error",
        message: "No se pudo actualizar la configuración",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Configuración de Branding</Title>
        <Button onClick={handleSave} loading={loading} size="lg">
          💾 Guardar cambios
        </Button>
      </Group>

      <Alert variant="light" color="blue">
        Personaliza la apariencia de tu página pública. Los cambios se verán
        reflejados en{" "}
        <Text component="span" fw={500}>
          /org/{org.domainSlug}
        </Text>
      </Alert>

      <Tabs defaultValue="general">
        <Tabs.List>
          <Tabs.Tab value="general">ℹ️ General</Tabs.Tab>
          <Tabs.Tab value="logo">🏷️ Logo</Tabs.Tab>
          <Tabs.Tab value="colors">🎨 Colores</Tabs.Tab>
          <Tabs.Tab value="header">📌 Header</Tabs.Tab>
          <Tabs.Tab value="footer">📄 Footer</Tabs.Tab>
        </Tabs.List>

        {/* General */}
        <Tabs.Panel value="general" pt="lg">
          <Card withBorder>
            <Stack gap="md">
              <Text size="sm" fw={500}>
                Información de la organización
              </Text>
              <Text size="xs" c="dimmed">
                Información básica que aparecerá en tu página pública
              </Text>

              <TextInput
                label="Nombre de la organización"
                placeholder="Mi Organización"
                value={org.name}
                disabled
                description="El nombre no se puede cambiar desde aquí. Contacta soporte si necesitas cambiarlo."
              />

              <Textarea
                label="Descripción"
                placeholder="Describe tu organización..."
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
                minRows={4}
                maxRows={8}
                description="Esta descripción aparecerá en la sección 'Sobre nosotros' de tu página principal"
              />

              <Divider />

              <div>
                <Text size="sm" fw={500} mb="xs">
                  URL de la organización
                </Text>
                <Text size="xs" c="dimmed" mb="sm">
                  Tu organización está disponible en:
                </Text>
                <Text size="md" fw={600} c="blue">
                  {window.location.origin}/org/{org.domainSlug}
                </Text>
              </div>
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* Logo */}
        <Tabs.Panel value="logo" pt="lg">
          <Card withBorder>
            <Stack gap="md">
              <Text size="sm" fw={500}>
                Logo de la organización
              </Text>
              <Text size="xs" c="dimmed">
                Este logo se mostrará en las páginas públicas de tu organización
              </Text>

              {branding.logoUrl && (
                <Group>
                  <Image
                    src={branding.logoUrl}
                    alt="Logo de la organización"
                    h={80}
                    w="auto"
                    fit="contain"
                    radius="md"
                  />
                  <ActionIcon
                    color="red"
                    variant="light"
                    onClick={() => updateField("logoUrl", undefined)}
                  >
                    🗑️
                  </ActionIcon>
                </Group>
              )}

              <FileInput
                placeholder="Subir logo"
                accept="image/*"
                onChange={async (file) => {
                  if (!file) return;
                  try {
                    setUploadingImage("logo");
                    const result = await uploadBrandingImage(org.domainSlug, "logos", file);
                    updateField("logoUrl", result.url);
                    notifications.show({
                      title: "Éxito",
                      message: "Logo subido. Recuerda guardar los cambios.",
                      color: "green",
                    });
                  } catch (error) {
                    console.error(error);
                    notifications.show({
                      title: "Error",
                      message: "No se pudo subir el logo",
                      color: "red",
                    });
                  } finally {
                    setUploadingImage(null);
                  }
                }}
                disabled={uploadingImage === "logo"}
                leftSection={
                  uploadingImage === "logo" ? <Loader size="xs" /> : "📁"
                }
              />
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* Colores */}
        <Tabs.Panel value="colors" pt="lg">
          <Card withBorder>
            <Stack gap="md">
              <Text size="sm" fw={500}>
                Paleta de colores personalizados
              </Text>

              <Group grow>
                <ColorInput
                  label="Color primario"
                  value={branding.colors?.primary || ""}
                  onChange={(value) =>
                    updateNestedField("colors", "primary", value)
                  }
                  placeholder="#3B82F6"
                />
                <ColorInput
                  label="Color secundario"
                  value={branding.colors?.secondary || ""}
                  onChange={(value) =>
                    updateNestedField("colors", "secondary", value)
                  }
                  placeholder="#8B5CF6"
                />
              </Group>

              <Group grow>
                <ColorInput
                  label="Color de acento"
                  value={branding.colors?.accent || ""}
                  onChange={(value) =>
                    updateNestedField("colors", "accent", value)
                  }
                  placeholder="#10B981"
                />
                <ColorInput
                  label="Color de fondo"
                  value={branding.colors?.background || ""}
                  onChange={(value) =>
                    updateNestedField("colors", "background", value)
                  }
                  placeholder="#FFFFFF"
                />
              </Group>

              <ColorInput
                label="Color de texto"
                value={branding.colors?.text || ""}
                onChange={(value) => updateNestedField("colors", "text", value)}
                placeholder="#1F2937"
              />

              <Button
                variant="light"
                onClick={() => updateField("colors", {})}
                size="xs"
              >
                Restablecer colores por defecto
              </Button>
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* Header */}
        <Tabs.Panel value="header" pt="lg">
          <Card withBorder>
            <Stack gap="md">
              <Switch
                label="Habilitar header personalizado"
                checked={branding.header?.enabled || false}
                onChange={(e) =>
                  updateNestedField(
                    "header",
                    "enabled",
                    e.currentTarget.checked
                  )
                }
              />

              {branding.header?.enabled && (
                <>
                  <Divider />

                  <div>
                    <Text size="sm" fw={500} mb="xs">
                      Imagen de fondo desktop
                    </Text>
                    <Text size="xs" c="dimmed" mb="sm">
                      Imagen que se mostrará en el header en dispositivos desktop
                    </Text>
                    {branding.header?.backgroundImageUrl && (
                      <Group mb="xs">
                        <Image
                          src={branding.header.backgroundImageUrl}
                          alt="Header Desktop"
                          h={80}
                          w={150}
                          fit="cover"
                          radius="md"
                        />
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() =>
                            updateNestedField("header", "backgroundImageUrl", undefined)
                          }
                        >
                          🗑️
                        </ActionIcon>
                      </Group>
                    )}
                    <FileInput
                      placeholder="Subir imagen desktop"
                      accept="image/*"
                      onChange={async (file) => {
                        if (!file) return;
                        try {
                          setUploadingImage("header-desktop");
                          const result = await uploadBrandingImage(org.domainSlug, "headers", file);
                          updateNestedField("header", "backgroundImageUrl", result.url);
                          notifications.show({
                            title: "Éxito",
                            message: "Imagen desktop subida. Recuerda guardar los cambios.",
                            color: "green",
                          });
                        } catch (error) {
                          console.error(error);
                          notifications.show({
                            title: "Error",
                            message: "No se pudo subir la imagen",
                            color: "red",
                          });
                        } finally {
                          setUploadingImage(null);
                        }
                      }}
                      disabled={uploadingImage === "header-desktop"}
                      leftSection={
                        uploadingImage === "header-desktop" ? (
                          <Loader size="xs" />
                        ) : (
                          "📁"
                        )
                      }
                    />
                  </div>

                  <Divider />

                  <div>
                    <Text size="sm" fw={500} mb="xs">
                      Imagen de fondo mobile
                    </Text>
                    <Text size="xs" c="dimmed" mb="sm">
                      Imagen que se mostrará en el header en dispositivos móviles
                    </Text>
                    {branding.header?.backgroundImageMobileUrl && (
                      <Group mb="xs">
                        <Image
                          src={branding.header.backgroundImageMobileUrl}
                          alt="Header Mobile"
                          h={80}
                          w={150}
                          fit="cover"
                          radius="md"
                        />
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() =>
                            updateNestedField("header", "backgroundImageMobileUrl", undefined)
                          }
                        >
                          🗑️
                        </ActionIcon>
                      </Group>
                    )}
                    <FileInput
                      placeholder="Subir imagen mobile"
                      accept="image/*"
                      onChange={async (file) => {
                        if (!file) return;
                        try {
                          setUploadingImage("header-mobile");
                          const result = await uploadBrandingImage(org.domainSlug, "headers", file);
                          updateNestedField("header", "backgroundImageMobileUrl", result.url);
                          notifications.show({
                            title: "Éxito",
                            message: "Imagen mobile subida. Recuerda guardar los cambios.",
                            color: "green",
                          });
                        } catch (error) {
                          console.error(error);
                          notifications.show({
                            title: "Error",
                            message: "No se pudo subir la imagen",
                            color: "red",
                          });
                        } finally {
                          setUploadingImage(null);
                        }
                      }}
                      disabled={uploadingImage === "header-mobile"}
                      leftSection={
                        uploadingImage === "header-mobile" ? (
                          <Loader size="xs" />
                        ) : (
                          "📁"
                        )
                      }
                    />
                  </div>
                </>
              )}
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* Footer */}
        <Tabs.Panel value="footer" pt="lg">
          <Card withBorder>
            <Stack gap="md">
              <Switch
                label="Habilitar footer personalizado"
                checked={branding.footer?.enabled || false}
                onChange={(e) =>
                  updateNestedField(
                    "footer",
                    "enabled",
                    e.currentTarget.checked
                  )
                }
              />

              {branding.footer?.enabled && (
                <>
                  <Divider />

                  <div>
                    <Text size="sm" fw={500} mb="xs">
                      Imagen de fondo desktop
                    </Text>
                    <Text size="xs" c="dimmed" mb="sm">
                      Imagen que se mostrará en el footer en dispositivos desktop
                    </Text>
                    {branding.footer?.backgroundImageUrl && (
                      <Group mb="xs">
                        <Image
                          src={branding.footer.backgroundImageUrl}
                          alt="Footer Desktop"
                          h={80}
                          w={150}
                          fit="cover"
                          radius="md"
                        />
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() =>
                            updateNestedField("footer", "backgroundImageUrl", undefined)
                          }
                        >
                          🗑️
                        </ActionIcon>
                      </Group>
                    )}
                    <FileInput
                      placeholder="Subir imagen desktop"
                      accept="image/*"
                      onChange={async (file) => {
                        if (!file) return;
                        try {
                          setUploadingImage("footer-desktop");
                          const result = await uploadBrandingImage(org.domainSlug, "footers", file);
                          updateNestedField("footer", "backgroundImageUrl", result.url);
                          notifications.show({
                            title: "Éxito",
                            message: "Imagen desktop subida. Recuerda guardar los cambios.",
                            color: "green",
                          });
                        } catch (error) {
                          console.error(error);
                          notifications.show({
                            title: "Error",
                            message: "No se pudo subir la imagen",
                            color: "red",
                          });
                        } finally {
                          setUploadingImage(null);
                        }
                      }}
                      disabled={uploadingImage === "footer-desktop"}
                      leftSection={
                        uploadingImage === "footer-desktop" ? (
                          <Loader size="xs" />
                        ) : (
                          "📁"
                        )
                      }
                    />
                  </div>

                  <Divider />

                  <div>
                    <Text size="sm" fw={500} mb="xs">
                      Imagen de fondo mobile
                    </Text>
                    <Text size="xs" c="dimmed" mb="sm">
                      Imagen que se mostrará en el footer en dispositivos móviles
                    </Text>
                    {branding.footer?.backgroundImageMobileUrl && (
                      <Group mb="xs">
                        <Image
                          src={branding.footer.backgroundImageMobileUrl}
                          alt="Footer Mobile"
                          h={80}
                          w={150}
                          fit="cover"
                          radius="md"
                        />
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() =>
                            updateNestedField("footer", "backgroundImageMobileUrl", undefined)
                          }
                        >
                          🗑️
                        </ActionIcon>
                      </Group>
                    )}
                    <FileInput
                      placeholder="Subir imagen mobile"
                      accept="image/*"
                      onChange={async (file) => {
                        if (!file) return;
                        try {
                          setUploadingImage("footer-mobile");
                          const result = await uploadBrandingImage(org.domainSlug, "footers", file);
                          updateNestedField("footer", "backgroundImageMobileUrl", result.url);
                          notifications.show({
                            title: "Éxito",
                            message: "Imagen mobile subida. Recuerda guardar los cambios.",
                            color: "green",
                          });
                        } catch (error) {
                          console.error(error);
                          notifications.show({
                            title: "Error",
                            message: "No se pudo subir la imagen",
                            color: "red",
                          });
                        } finally {
                          setUploadingImage(null);
                        }
                      }}
                      disabled={uploadingImage === "footer-mobile"}
                      leftSection={
                        uploadingImage === "footer-mobile" ? (
                          <Loader size="xs" />
                        ) : (
                          "📁"
                        )
                      }
                    />
                  </div>
                </>
              )}
            </Stack>
          </Card>
        </Tabs.Panel>

      </Tabs>

      <Group justify="flex-end">
        <Button onClick={handleSave} loading={loading} size="lg">
          💾 Guardar todos los cambios
        </Button>
      </Group>

      {/* Zona de peligro */}
      <Card withBorder radius="lg" p="lg" style={{ borderColor: "var(--mantine-color-red-4)" }}>
        <Stack gap="md">
          <div>
            <Title order={3} c="red">Zona de peligro</Title>
            <Text c="dimmed" size="sm" mt={4}>
              Las acciones de esta sección son permanentes e irreversibles.
            </Text>
          </div>

          <Divider color="red.2" />

          <Group justify="space-between" align="center">
            <div>
              <Text fw={500}>Eliminar organización</Text>
              <Text size="sm" c="dimmed">
                Elimina la organización y todos sus eventos, asistentes, métricas, encuestas, plantillas de email y configuraciones de streaming.
              </Text>
            </div>
            <Button
              color="red"
              variant="outline"
              leftSection={<IconTrash size={16} />}
              onClick={() => {
                setDeleteConfirmText("");
                setDeleteModalOpen(true);
              }}
            >
              Eliminar organización
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* Modal de confirmación de eliminación */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title={<Text fw={700} c="red" size="lg">Eliminar organización</Text>}
        centered
        size="md"
      >
        <Stack gap="md">
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            Esta acción eliminará permanentemente:
            <ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
              <li>La organización y su configuración</li>
              <li>Todos los eventos y sus datos</li>
              <li>Todos los asistentes registrados</li>
              <li>Métricas, encuestas y campañas de email</li>
              <li>Configuraciones de streaming</li>
            </ul>
          </Alert>

          <Text size="sm">
            Escribe el nombre de la organización para confirmar:{" "}
            <Text component="span" fw={700}>{org.name}</Text>
          </Text>

          <TextInput
            placeholder={org.name}
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.currentTarget.value)}
            disabled={deleting}
          />

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              disabled={deleteConfirmText !== org.name}
              loading={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  const result = await deleteOrg(org.domainSlug);
                  notifications.show({
                    title: "Organización eliminada",
                    message: `"${org.name}" y ${result.deletedEvents} evento(s) fueron eliminados`,
                    color: "green",
                  });
                  navigate("/organizations");
                } catch {
                  notifications.show({
                    title: "Error",
                    message: "No se pudo eliminar la organización",
                    color: "red",
                  });
                } finally {
                  setDeleting(false);
                  setDeleteModalOpen(false);
                }
              }}
            >
              Confirmar eliminación
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
