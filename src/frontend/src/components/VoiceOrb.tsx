"use client";

import type { VoiceStatus } from "@/lib/voice";

/**
 * Small self-contained orb that reflects voice mode state:
 * idle (dim), connecting (pulse), listening (accent ring), speaking (ripple).
 * No external deps — pure CSS so it can be removed by hiding one button.
 */
export function VoiceOrb({ status }: { status: VoiceStatus }) {
  const speaking = status === "speaking";
  const listening = status === "listening";
  const connecting = status === "connecting";

  return (
    <span className="relative inline-flex items-center justify-center w-6 h-6" aria-hidden>
      {(listening || speaking) && (
        <span
          className={`absolute inset-0 rounded-full ${speaking ? "bg-accent/40" : "bg-accent/25"} animate-ping`}
        />
      )}
      <span
        className={`relative rounded-full transition-all duration-300 ${
          connecting
            ? "w-3 h-3 bg-accent animate-pulse"
            : listening
            ? "w-3.5 h-3.5 bg-accent shadow-[0_0_10px_var(--accent)]"
            : speaking
            ? "w-4 h-4 bg-accent shadow-[0_0_14px_var(--accent)]"
            : "w-2.5 h-2.5 bg-muted"
        }`}
      />
    </span>
  );
}
