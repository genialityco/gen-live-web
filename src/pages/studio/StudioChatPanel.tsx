/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useChat,
  useLocalParticipantPermissions,
} from "@livekit/components-react";
import {
  ActionIcon,
  Box,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { IconSend } from "@tabler/icons-react";

function fmtTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

interface StudioChatPanelProps {
  chatOpen: boolean;
  setUnread: React.Dispatch<React.SetStateAction<number>>;
  myId: string | undefined;
}

export function StudioChatPanel({
  chatOpen,
  setUnread,
  myId,
}: StudioChatPanelProps) {
  const { chatMessages, send, isSending } = useChat(); // :contentReference[oaicite:1]{index=1}
  const permissions = useLocalParticipantPermissions();
  const canPublishData = permissions?.canPublishData ?? false;

  const [draft, setDraft] = useState("");
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // autoscroll al final cuando llega mensaje
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chatMessages.length]);

  const messages = useMemo(() => {
    // opcional: podrías agrupar, filtrar, etc.
    return chatMessages;
  }, [chatMessages]);

  const doSend = async () => {
    const text = draft.trim();
    if (!text || isSending || !canPublishData) return;
    setDraft("");
    try {
      await send(text);
    } catch {
      // si quieres: toast/notification
    }
  };

  useEffect(() => {
    if (!chatMessages.length) return;
    const last = chatMessages[chatMessages.length - 1];
    const fromOther =
      last.from?.identity && myId && last.from.identity !== myId;

    if (!chatOpen && fromOther) setUnread((u) => Math.min(99, u + 1));
    if (chatOpen) setUnread(0);
  }, [chatMessages.length, chatOpen, myId, setUnread]);

  return (
    <Paper
      radius="lg"
      withBorder
      style={{
        height: "min(560px, calc(100dvh - 180px))",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background:
          "radial-gradient(900px 500px at 20% 0%, rgba(99,102,241,0.16), transparent 55%), rgba(0,0,0,0.12)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      {/* header */}
      <Group
        justify="space-between"
        px="md"
        py="sm"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <Text fw={700}>Chat</Text>
        <Text size="xs" c="dimmed">
          {messages.length ? `${messages.length} msg` : "—"}
        </Text>
      </Group>

      {/* mensajes */}
      <ScrollArea
        viewportRef={viewportRef}
        style={{ flex: 1 }}
        px="md"
        py="sm"
        offsetScrollbars
      >
        <Stack gap="xs">
          {messages.map((m) => {
            const mine = !!(
              m.from?.identity &&
              myId &&
              m.from.identity === myId
            );

            const name = mine
              ? "Tú"
              : m.from?.name || m.from?.identity || "Invitado";
            const time = fmtTime(m.timestamp);

            return (
              <Box
                key={`${m.timestamp}-${m.from?.identity ?? "x"}`}
                style={{
                  display: "flex",
                  justifyContent: mine ? "flex-end" : "flex-start",
                }}
              >
                <Box style={{ maxWidth: "82%" }}>
                  <Text
                    size="xs"
                    c="dimmed"
                    style={{
                      marginBottom: 4,
                      textAlign: mine ? "right" : "left",
                    }}
                  >
                    {name} · {time}
                  </Text>

                  <Box
                    style={{
                      padding: "10px 12px",
                      borderRadius: 16,
                      lineHeight: 1.35,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      background: mine
                        ? "linear-gradient(135deg, rgba(99,102,241,0.95), rgba(236,72,153,0.85))"
                        : "rgba(255,255,255,0.06)",
                      border: mine
                        ? "1px solid rgba(255,255,255,0.10)"
                        : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <Text size="sm" c={mine ? "white" : undefined}>
                      {m.message}
                    </Text>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Stack>
      </ScrollArea>

      {/* input */}
      <Box
        px="md"
        py="sm"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <Group align="flex-end" gap="sm">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            placeholder={
              canPublishData
                ? "Escribe un mensaje…"
                : "Sin permiso para enviar (data)"
            }
            autosize
            minRows={1}
            maxRows={4}
            disabled={!canPublishData}
            styles={{
              input: {
                borderRadius: 14,
                background: "rgba(0,0,0,0.20)",
                border: "1px solid rgba(255,255,255,0.10)",
              },
            }}
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void doSend();
              }
            }}
          />

          <Tooltip label="Enviar (Enter)">
            <ActionIcon
              radius="xl"
              size="lg"
              variant="filled"
              disabled={!draft.trim() || isSending || !canPublishData}
              onClick={() => void doSend()}
              style={{
                boxShadow: "0 10px 30px rgba(0,0,0,.25)",
              }}
            >
              <IconSend size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Text size="xs" c="dimmed" mt={6}>
          Enter envía · Shift+Enter salto de línea
        </Text>
      </Box>
    </Paper>
  );
}
