/**
 * Minimal MSAL.js wrapper for On-Behalf-Of (OBO) sign-in.
 *
 * The user signs in with their Entra account and we acquire an access token
 * scoped to the Entra-protected OBO MCP server (`api://<server>/access_as_user`).
 * That token is attached to the chat request (see `lib/api.ts`), forwarded by
 * the backend to the hosted agent, and injected as the `Authorization` header on
 * the OBO MCP server so its tools (e.g. Microsoft Graph `/me`) run as the user.
 *
 * This wraps `@azure/msal-browser` directly (no MsalProvider) to keep the
 * integration small and easy to follow. When OBO is not configured every
 * function is a graceful no-op so the rest of the app is unaffected.
 */
import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  type AccountInfo,
} from "@azure/msal-browser";

import { getAuthConfig } from "@/lib/config";

let _pca: PublicClientApplication | null = null;
let _initPromise: Promise<PublicClientApplication | null> | null = null;

/** True when an Entra app registration is configured for OBO sign-in. */
export function isAuthConfigured(): boolean {
  return getAuthConfig() !== null;
}

async function getClient(): Promise<PublicClientApplication | null> {
  if (typeof window === "undefined") return null;
  const cfg = getAuthConfig();
  if (!cfg) return null;
  if (_pca) return _pca;
  if (!_initPromise) {
    const pca = new PublicClientApplication({
      auth: {
        clientId: cfg.clientId,
        authority: cfg.authority,
        redirectUri: window.location.origin + (cfg.basePath || ""),
      },
      cache: { cacheLocation: "sessionStorage" },
    });
    _initPromise = pca
      .initialize()
      .then(() => {
        const existing = pca.getActiveAccount() || pca.getAllAccounts()[0];
        if (existing) pca.setActiveAccount(existing);
        _pca = pca;
        return pca;
      })
      .catch((err) => {
        console.warn("MSAL initialization failed", err);
        return null;
      });
  }
  return _initPromise;
}

/** The signed-in account, or null. */
export function getActiveAccount(): AccountInfo | null {
  if (!_pca) return null;
  return _pca.getActiveAccount() || _pca.getAllAccounts()[0] || null;
}

/** Friendly display name / username of the signed-in user, or null. */
export function getSignedInName(): string | null {
  const account = getActiveAccount();
  return account ? account.name || account.username : null;
}

/**
 * Acquire an OBO MCP access token for the signed-in user.
 *
 * Tries a silent acquisition first and falls back to an interactive popup when
 * the user is not signed in or consent/interaction is required. Returns null
 * when OBO is not configured (feature disabled) so callers can no-op safely.
 *
 * @param interactive When false, never opens a popup — returns null if a token
 *   can't be obtained silently (use for background/optional acquisition).
 */
export async function getMcpAccessToken(interactive = true): Promise<string | null> {
  const pca = await getClient();
  if (!pca) return null;
  const cfg = getAuthConfig();
  if (!cfg) return null;

  const account = pca.getActiveAccount() || pca.getAllAccounts()[0] || null;

  if (account) {
    try {
      const result = await pca.acquireTokenSilent({ account, scopes: [cfg.scope] });
      pca.setActiveAccount(result.account);
      return result.accessToken;
    } catch (err) {
      if (!(err instanceof InteractionRequiredAuthError)) throw err;
      if (!interactive) return null;
    }
  } else if (!interactive) {
    return null;
  }

  const result = await pca.acquireTokenPopup({ scopes: [cfg.scope] });
  pca.setActiveAccount(result.account);
  return result.accessToken;
}

/** Interactively sign the user in and acquire the OBO scope. */
export async function signIn(): Promise<boolean> {
  const token = await getMcpAccessToken(true);
  return token !== null;
}

/** Sign the user out of the local MSAL session. */
export async function signOut(): Promise<void> {
  const pca = await getClient();
  if (!pca) return;
  const account = getActiveAccount();
  await pca.logoutPopup({ account: account ?? undefined });
}
