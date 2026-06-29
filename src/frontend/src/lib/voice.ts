/**
 * Realtime voice hook — STT + TTS over WebRTC against Azure GPT Realtime.
 *
 * The agent stays the brain: we only transcribe the user's speech (→ onTranscript,
 * which feeds the normal chat send path) and speak final assistant replies.
 * turn_detection has create_response:false server-side so Realtime never answers.
 *
 * Token + endpoint come from /api/voice/session — the long-lived key never
 * reaches the browser. Loosely coupled: hide the button and it's gone.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/lib/config";

export type VoiceStatus = "idle" | "connecting" | "listening" | "speaking" | "error";

interface VoiceSession {
  token: string;
  endpoint: string;
  deployment: string;
  voice: string;
}

interface UseRealtimeOpts {
  onTranscript: (text: string) => void;
}

export function useRealtime({ onTranscript }: UseRealtimeOpts) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef(onTranscript);
  transcriptRef.current = onTranscript;

  const stop = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.close();
    micRef.current?.getTracks().forEach((t) => t.stop());
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.remove();
    }
    dcRef.current = null;
    pcRef.current = null;
    micRef.current = null;
    audioRef.current = null;
    setActive(false);
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      setStatus("connecting");
      const res = await fetch(`${getApiUrl()}/api/voice/session`);
      if (!res.ok) throw new Error(`voice session ${res.status}`);
      const s: VoiceSession = await res.json();

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audio = document.createElement("audio");
      audio.autoplay = true;
      document.body.appendChild(audio);
      audioRef.current = audio;
      pc.ontrack = (e) => {
        if (e.streams[0]) audio.srcObject = e.streams[0];
      };

      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micRef.current = mic;
      pc.addTrack(mic.getAudioTracks()[0]);

      const dc = pc.createDataChannel("realtime-channel");
      dcRef.current = dc;
      dc.addEventListener("message", (ev) => {
        let evt: { type?: string; transcript?: string };
        try {
          evt = JSON.parse(ev.data);
        } catch {
          return;
        }
        switch (evt.type) {
          case "input_audio_buffer.speech_started":
            // Barge-in: stop assistant TTS the moment the user starts talking.
            try {
              dc.send(JSON.stringify({ type: "response.cancel" }));
            } catch {
              /* ignore */
            }
            setStatus("listening");
            break;
          case "conversation.item.input_audio_transcription.completed":
            if (evt.transcript?.trim()) transcriptRef.current(evt.transcript.trim());
            break;
          case "response.output_audio_transcript.delta":
            setStatus("speaking");
            break;
          case "response.output_audio_transcript.done":
            setStatus("listening");
            break;
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpRes = await fetch(
        `${s.endpoint}/openai/v1/realtime/calls?model=${encodeURIComponent(s.deployment)}&webrtcfilter=on`,
        {
          method: "POST",
          body: offer.sdp,
          headers: { Authorization: `Bearer ${s.token}`, "Content-Type": "application/sdp" },
        }
      );
      if (!sdpRes.ok) throw new Error(`sdp ${sdpRes.status}`);
      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });

      setActive(true);
      setStatus("listening");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
      stop();
    }
  }, [stop]);

  // Speak the assistant's final answer (not the raw stream) for smooth TTS.
  const speak = useCallback((text: string) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open" || !text.trim()) return;
    dc.send(
      JSON.stringify({
        type: "response.create",
        response: { instructions: `Read this reply aloud verbatim: ${text}` },
      })
    );
    setStatus("speaking");
  }, []);

  useEffect(() => stop, [stop]);

  return { status, active, error, start, stop, speak };
}
