"use client";

import { useEffect, useState } from "react";
import {
  isAuthConfigured,
  getSignedInName,
  signIn,
  signOut,
} from "@/lib/auth";

/**
 * Compact OBO sign-in control for the sidebar footer.
 *
 * Only renders when an Entra app registration is configured (see
 * `getAuthConfig`). Lets the user sign in so their identity flows
 * On-Behalf-Of to the OBO MCP server's tools (e.g. Microsoft Graph `/me`).
 */
export function OboSignIn() {
  const [configured, setConfigured] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setConfigured(isAuthConfigured());
    setName(getSignedInName());
  }, []);

  if (!configured) return null;

  async function handleSignIn() {
    setBusy(true);
    try {
      const ok = await signIn();
      if (ok) setName(getSignedInName());
    } catch (err) {
      console.warn("Sign-in failed", err);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      setName(null);
    } catch (err) {
      console.warn("Sign-out failed", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={name ? handleSignOut : handleSignIn}
      disabled={busy}
      title={name ? `Signed in as ${name} — click to sign out` : "Sign in for On-Behalf-Of tools"}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-text hover:text-text-strong hover:bg-hover rounded-xl transition-all active:scale-[0.98] disabled:opacity-60"
    >
      <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
      <span className="truncate">
        {busy ? "Working…" : name ? `Signed in: ${name}` : "Sign in (On-Behalf-Of)"}
      </span>
    </button>
  );
}
