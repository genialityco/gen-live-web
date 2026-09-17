// src/StudioPage.tsx
import React from "react";
import { useParams } from "react-router-dom";
import { Container, Paper, Title, Text } from "@mantine/core";
import { StudioView } from "./StudioView";

export const StudioPage: React.FC = () => {
  const { slug, eventSlug } = useParams<{ slug: string; eventSlug: string }>();

  if (!eventSlug) {
    return (
      <Container size="sm" py="xl">
        <Paper radius="md" p="lg" withBorder>
          <Title order={3}>Falta eventSlug en la URL</Title>
          <Text c="dimmed" mt="xs">
            Asegúrate de entrar por una ruta como{" "}
            <Text span fw={600}>
              /studio/mi-evento
            </Text>
            .
          </Text>
        </Paper>
      </Container>
    );
  }

  return <StudioView eventSlug={eventSlug} orgSlug={slug} role="host" />;
};
