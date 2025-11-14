import { useState } from "react";
import {
  Stack,
  Title,
  Card,
  Text,
  Button,
  Group,
  ColorInput,
  Switch,
  FileInput,
  Divider,
  Alert,
  Tabs,
  Box,
} from "@mantine/core";
import { IconPhoto, IconPalette, IconEye } from "@tabler/icons-react";
import { type EventItem, type EventBrandingConfig, updateEventBranding, uploadEventImage } from "../../api/events";
import { notifications } from "@mantine/notifications";

interface EventBrandingConfiguratorProps {
  event: EventItem;
  onUpdate?: (branding: EventBrandingConfig) => void;
}

export default function EventBrandingConfigurator({ 
  event, 
  onUpdate 
}: EventBrandingConfiguratorProps) {
  const [branding, setBranding] = useState<EventBrandingConfig>(
    event.branding || {}
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null); // Track which image is uploading

  const handleImageUpload = async (
    section: 'header' | 'footer' | 'coverImage',
    type: 'desktop' | 'mobile',
    file: File | null
  ) => {
    if (!file) return;

    const uploadKey = `${section}-${type}`;
    setUploading(uploadKey);

    try {
      // Determinar el folder para el backend
      let folder: 'headers' | 'covers' | 'footers';
      if (section === 'coverImage') {
        folder = 'covers';
      } else if (section === 'header') {
        folder = 'headers';
      } else {
        folder = 'footers';
      }

      // Subir archivo a Firebase Storage
      const response = await uploadEventImage(event._id, folder, file);
      const imageUrl = response.url;
      
      // Actualizar el estado con la URL de Firebase
      if (section === 'coverImage') {
        setBranding(prev => ({
          ...prev,
          [type === 'desktop' ? 'coverImageUrl' : 'coverImageMobileUrl']: imageUrl,
        }));
      } else {
        setBranding(prev => ({
          ...prev,
          [section]: {
            ...prev[section],
            [type === 'desktop' ? 'backgroundImageUrl' : 'backgroundImageMobileUrl']: imageUrl,
          }
        }));
      }

      notifications.show({
        title: "Imagen subida",
        message: "La imagen se ha subido correctamente a Firebase Storage",
        color: "green",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      notifications.show({
        title: "Error",
        message: "No se pudo subir la imagen",
        color: "red",
      });
    } finally {
      setUploading(null);
    }
  };

  const handleColorChange = (field: keyof NonNullable<EventBrandingConfig['colors']>, value: string) => {
    setBranding(prev => ({
      ...prev,
      colors: {
        ...prev.colors,
        [field]: value || undefined,
      }
    }));
  };

  const handleHeaderChange = (field: keyof NonNullable<EventBrandingConfig['header']>, value: boolean | string | undefined) => {
    setBranding(prev => ({
      ...prev,
      header: {
        ...prev.header,
        [field]: value,
      }
    }));
  };

  const handleFooterChange = (field: keyof NonNullable<EventBrandingConfig['footer']>, value: boolean | string | undefined) => {
    setBranding(prev => ({
      ...prev,
      footer: {
        ...prev.footer,
        [field]: value,
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Actualizar branding del evento
      const updatedEvent = await updateEventBranding(event._id, branding);
      console.log("Branding actualizado:", updatedEvent);
      
      onUpdate?.(branding);
      
      notifications.show({
        title: "Branding actualizado",
        message: "La configuración visual del evento se ha guardado correctamente",
        color: "green",
      });
    } catch (error) {
      console.error("Error saving branding:", error);
      notifications.show({
        title: "Error",
        message: "No se pudo guardar la configuración de branding",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setBranding({});
    notifications.show({
      title: "Branding reiniciado",
      message: "Se eliminó la personalización del evento. Ahora heredará el branding de la organización",
      color: "blue",
    });
  };

  const hasCustomBranding = Object.keys(branding).length > 0;

  return (
    <Card withBorder radius="lg" p="lg">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <div>
            <Title order={3}>🎨 Branding del Evento</Title>
            <Text c="dimmed" size="sm">
              Personaliza la apariencia visual específica de este evento
            </Text>
          </div>
          <Group gap="sm">
            {hasCustomBranding && (
              <Button
                variant="subtle"
                size="sm"
                onClick={handleReset}
                color="gray"
              >
                Reiniciar
              </Button>
            )}
            <Button
              onClick={handleSave}
              loading={saving}
              leftSection={<IconEye size={16} />}
            >
              Guardar cambios
            </Button>
          </Group>
        </Group>

        {!hasCustomBranding && (
          <Alert color="blue" variant="light">
            <Text size="sm">
              Este evento está usando el branding de la organización. 
              Configura elementos específicos abajo para crear una identidad visual única.
            </Text>
          </Alert>
        )}

        <Tabs defaultValue="colors" variant="pills">
          <Tabs.List>
            <Tabs.Tab value="colors" leftSection={<IconPalette size={16} />}>
              Colores
            </Tabs.Tab>
            <Tabs.Tab value="images" leftSection={<IconPhoto size={16} />}>
              Imágenes
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="colors" pt="lg">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Define colores específicos para este evento. Dejar vacío heredará los colores de la organización.
              </Text>
              
              <Group gap="lg" align="flex-start">
                <Stack gap="sm" style={{ flex: 1 }}>
                  <ColorInput
                    label="Color primario"
                    description="Color principal del evento"
                    placeholder="Ejemplo: #FF6B35"
                    value={branding.colors?.primary || ""}
                    onChange={(value) => handleColorChange('primary', value)}
                    swatches={[
                      '#FF6B35', '#F7931E', '#FFD23F', '#06FFA5', 
                      '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
                      '#FF9FF3', '#54a0ff', '#5f27cd', '#00d2d3'
                    ]}
                  />
                  
                  <ColorInput
                    label="Color secundario"
                    description="Color de apoyo"
                    placeholder="Ejemplo: #2C3E50"
                    value={branding.colors?.secondary || ""}
                    onChange={(value) => handleColorChange('secondary', value)}
                  />
                </Stack>

                <Stack gap="sm" style={{ flex: 1 }}>
                  <ColorInput
                    label="Color de acento"
                    description="Para elementos destacados"
                    placeholder="Ejemplo: #E74C3C"
                    value={branding.colors?.accent || ""}
                    onChange={(value) => handleColorChange('accent', value)}
                  />
                  
                  <ColorInput
                    label="Color de fondo"
                    description="Fondo de la página"
                    placeholder="Ejemplo: #F8F9FA"
                    value={branding.colors?.background || ""}
                    onChange={(value) => handleColorChange('background', value)}
                  />
                </Stack>
              </Group>

              <ColorInput
                label="Color de texto"
                description="Color principal del texto"
                placeholder="Ejemplo: #2C3E50"
                value={branding.colors?.text || ""}
                onChange={(value) => handleColorChange('text', value)}
                style={{ maxWidth: '300px' }}
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="images" pt="lg">
            <Stack gap="lg">
              {/* Header */}
              <Box>
                <Title order={4} size="h5" mb="sm">Header del evento</Title>
                <Stack gap="sm">
                  <Switch
                    label="Activar header personalizado"
                    description="Mostrar un header con imagen de fondo"
                    checked={branding.header?.enabled || false}
                    onChange={(event) => 
                      handleHeaderChange('enabled', event.currentTarget.checked)
                    }
                  />
                  
                  {branding.header?.enabled && (
                    <>
                      <FileInput
                        label="Imagen de fondo (Desktop)"
                        description={branding.header?.backgroundImageUrl ? 
                          "✅ Imagen cargada - Selecciona otra para reemplazar" : 
                          uploading === 'header-desktop' ? "🔄 Subiendo..." :
                          "Imagen para pantallas grandes (recomendado: 1920x400px)"
                        }
                        placeholder="Seleccionar imagen..."
                        accept="image/*"
                        leftSection={<IconPhoto size={16} />}
                        onChange={(file) => handleImageUpload('header', 'desktop', file)}
                        disabled={uploading === 'header-desktop'}
                      />
                      
                      <FileInput
                        label="Imagen de fondo (Mobile)"
                        description={branding.header?.backgroundImageMobileUrl ? 
                          "✅ Imagen cargada - Selecciona otra para reemplazar" : 
                          uploading === 'header-mobile' ? "🔄 Subiendo..." :
                          "Imagen para dispositivos móviles (recomendado: 800x400px)"
                        }
                        placeholder="Seleccionar imagen..."
                        accept="image/*"
                        leftSection={<IconPhoto size={16} />}
                        onChange={(file) => handleImageUpload('header', 'mobile', file)}
                        disabled={uploading === 'header-mobile'}
                      />
                    </>
                  )}
                </Stack>
              </Box>

              <Divider />

              {/* Footer */}
              <Box>
                <Title order={4} size="h5" mb="sm">Footer del evento</Title>
                <Stack gap="sm">
                  <Switch
                    label="Activar footer personalizado"
                    description="Mostrar un footer con imagen de fondo"
                    checked={branding.footer?.enabled || false}
                    onChange={(event) => 
                      handleFooterChange('enabled', event.currentTarget.checked)
                    }
                  />
                  
                  {branding.footer?.enabled && (
                    <>
                      <FileInput
                        label="Imagen de fondo (Desktop)"
                        description={branding.footer?.backgroundImageUrl ? 
                          "✅ Imagen cargada - Selecciona otra para reemplazar" : 
                          uploading === 'footer-desktop' ? "🔄 Subiendo..." :
                          "Imagen para pantallas grandes (recomendado: 1920x300px)"
                        }
                        placeholder="Seleccionar imagen..."
                        accept="image/*"
                        leftSection={<IconPhoto size={16} />}
                        onChange={(file) => handleImageUpload('footer', 'desktop', file)}
                        disabled={uploading === 'footer-desktop'}
                      />
                      
                      <FileInput
                        label="Imagen de fondo (Mobile)"
                        description={branding.footer?.backgroundImageMobileUrl ? 
                          "✅ Imagen cargada - Selecciona otra para reemplazar" : 
                          uploading === 'footer-mobile' ? "🔄 Subiendo..." :
                          "Imagen para dispositivos móviles (recomendado: 800x300px)"
                        }
                        placeholder="Seleccionar imagen..."
                        accept="image/*"
                        leftSection={<IconPhoto size={16} />}
                        onChange={(file) => handleImageUpload('footer', 'mobile', file)}
                        disabled={uploading === 'footer-mobile'}
                      />
                    </>
                  )}
                </Stack>
              </Box>

              <Divider />

              {/* Cover Image */}
              <Box>
                <Title order={4} size="h5" mb="sm">Imagen de portada</Title>
                <Stack gap="sm">
                  <Text size="sm" c="dimmed">
                    Imagen principal que representa el evento (opcional)
                  </Text>
                  
                  <FileInput
                    label="Imagen de portada (Desktop)"
                    description={branding.coverImageUrl ? 
                      "✅ Imagen cargada - Selecciona otra para reemplazar" : 
                      uploading === 'coverImage-desktop' ? "🔄 Subiendo..." :
                      "Imagen principal del evento (recomendado: 1200x630px)"
                    }
                    placeholder="Seleccionar imagen..."
                    accept="image/*"
                    leftSection={<IconPhoto size={16} />}
                    onChange={(file) => handleImageUpload('coverImage', 'desktop', file)}
                    disabled={uploading === 'coverImage-desktop'}
                  />
                  
                  <FileInput
                    label="Imagen de portada (Mobile)"
                    description={branding.coverImageMobileUrl ? 
                      "✅ Imagen cargada - Selecciona otra para reemplazar" : 
                      uploading === 'coverImage-mobile' ? "🔄 Subiendo..." :
                      "Versión móvil de la imagen (recomendado: 800x600px)"
                    }
                    placeholder="Seleccionar imagen..."
                    accept="image/*"
                    leftSection={<IconPhoto size={16} />}
                    onChange={(file) => handleImageUpload('coverImage', 'mobile', file)}
                    disabled={uploading === 'coverImage-mobile'}
                  />
                </Stack>
              </Box>
            </Stack>
          </Tabs.Panel>

        </Tabs>
      </Stack>
    </Card>
  );
}