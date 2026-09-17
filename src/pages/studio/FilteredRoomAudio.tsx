/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/studio/FilteredRoomAudio.tsx
import { useEffect } from "react";
import { useRemoteParticipants } from "@livekit/components-react";
import { Track } from "livekit-client";
import { getScreenShareKey } from "../../utils/screen-share-utils";

/**
 * Reproduce únicamente el audio de los tracks que están en escena
 * (según stage.onStage), tanto en el backstage como en el canvas de egress
 * que se graba/transmite. Cámara y pantalla compartida se controlan por
 * separado porque cada una tiene su propia key en onStage.
 */
export function FilteredRoomAudio(props: { onStageMap: Record<string, boolean> }) {
  const remoteParticipants = useRemoteParticipants();

  return (
    <>
      {remoteParticipants.map((participant) => (
        <ParticipantAudio
          key={participant.identity}
          participant={participant}
          micOnStage={!!props.onStageMap[participant.identity]}
          screenOnStage={!!props.onStageMap[getScreenShareKey(participant.identity)]}
        />
      ))}
    </>
  );
}

/**
 * Adjunta/desconecta el audio del micrófono y de la pantalla compartida de
 * un participante de forma independiente, según su propia key de escena.
 */
function ParticipantAudio(props: {
  participant: any;
  micOnStage: boolean;
  screenOnStage: boolean;
}) {
  const microphoneTrack = props.participant.getTrackPublication(
    Track.Source.Microphone,
  )?.audioTrack;
  const screenShareAudioTrack = props.participant.getTrackPublication(
    Track.Source.ScreenShareAudio,
  )?.audioTrack;

  // Reproducir audio del micrófono solo si su key (cámara) está en escena
  useEffect(() => {
    if (!microphoneTrack || !props.micOnStage) return;

    const audioElement = microphoneTrack.attach();
    document.body.appendChild(audioElement);

    return () => {
      microphoneTrack.detach(audioElement);
      audioElement.remove();
    };
  }, [microphoneTrack, props.micOnStage]);

  // Reproducir audio de la pantalla compartida solo si su propia key está en escena
  useEffect(() => {
    if (!screenShareAudioTrack || !props.screenOnStage) return;

    const audioElement = screenShareAudioTrack.attach();
    document.body.appendChild(audioElement);

    return () => {
      screenShareAudioTrack.detach(audioElement);
      audioElement.remove();
    };
  }, [screenShareAudioTrack, props.screenOnStage]);

  return null;
}
