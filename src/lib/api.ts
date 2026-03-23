function getStatelyBaseUrl(): string {
  return import.meta.env.VITE_STATELY_BASE_URL || 'https://stately.ai';
}

function getBaseUrl(): string {
  if (import.meta.env.VITE_REGISTRY_API_URL) {
    return import.meta.env.VITE_REGISTRY_API_URL;
  }
  return `${getStatelyBaseUrl()}/registry/api/v1/viz`;
}

export interface UserData {
  id: string;
  displayName: string;
  avatarUrl: string;
  email: string;
}

const SUPABASE_COOKIE_PREFIX = 'sb-ascelcgzufjyvdzuplwo-auth-token';

function getSupabaseCookie(): string | null {
  // The auth-helpers may chunk large cookies: name, name.0, name.1, …
  const cookies = Object.fromEntries(
    document.cookie.split('; ').map((c) => {
      const [k, ...v] = c.split('=');
      return [k, decodeURIComponent(v.join('='))];
    }),
  );

  // Single cookie
  if (cookies[SUPABASE_COOKIE_PREFIX]) {
    return cookies[SUPABASE_COOKIE_PREFIX];
  }

  // Chunked cookies
  const chunks: string[] = [];
  for (let i = 0; ; i++) {
    const chunk = cookies[`${SUPABASE_COOKIE_PREFIX}.${i}`];
    if (!chunk) break;
    chunks.push(chunk);
  }
  return chunks.length ? chunks.join('') : null;
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const base64 = token.split('.')[1];
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export function getUser(): UserData | null {
  const raw = getSupabaseCookie();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    // Cookie is a JSON array: [access_token, refresh_token, ...]
    const accessToken = Array.isArray(parsed) ? parsed[0] : parsed.access_token;
    if (!accessToken) return null;
    const payload = decodeJwtPayload(accessToken);
    if (!payload) return null;
    const meta = payload.user_metadata ?? {};
    return {
      id: payload.sub,
      displayName: meta.full_name || meta.name || payload.email || 'User',
      avatarUrl: meta.avatar_url || '',
      email: payload.email || '',
    };
  } catch {
    return null;
  }
}

export function logout(): void {
  const redirectBack = window.location.href;
  window.location.href = `${getStatelyBaseUrl()}/registry/logout?redirectTo=${encodeURIComponent(redirectBack)}`;
}

export interface SourceFileData {
  id: string;
  text: string;
  name: string;
  description: string;
  updatedAt: string;
  format: string | null;
  likesCount: number;
  youHaveLiked: boolean;
  project: {
    id: string;
    name: string;
    owner: {
      id: string;
      displayName: string;
      avatarUrl: string;
    };
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function createSourceFile(
  text: string,
  name: string,
  opts?: { forkFromId?: string; format?: string },
): Promise<SourceFileData> {
  const res = await fetch(`${getBaseUrl()}/create-source-file`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      name,
      ...(opts?.forkFromId && { forkFromId: opts.forkFromId }),
      ...(opts?.format && { format: opts.format }),
    }),
  });

  if (!res.ok) {
    throw new ApiError(
      res.status === 401
        ? 'Not authenticated'
        : `Failed to create source file: ${res.status}`,
      res.status,
    );
  }

  const json = await res.json();
  return json.data;
}

export async function getSourceFile(
  sourceFileId: string,
): Promise<SourceFileData> {
  const res = await fetch(
    `${getBaseUrl()}/get-source-file?sourceFileId=${encodeURIComponent(sourceFileId)}`,
    { credentials: 'include' },
  );

  if (!res.ok) {
    throw new ApiError(
      res.status === 404
        ? 'Source file not found'
        : `Failed to load source file: ${res.status}`,
      res.status,
    );
  }

  const json = await res.json();
  return json.data;
}

const CODE_BACKUP_KEY = 'sketch:code-backup';

export function backupCodeBeforeLogin(code: string): void {
  try {
    localStorage.setItem(CODE_BACKUP_KEY, code);
  } catch {
    // storage full or unavailable — best-effort
  }
}

export function restoreCodeAfterLogin(): string | null {
  try {
    const code = localStorage.getItem(CODE_BACKUP_KEY);
    if (code) localStorage.removeItem(CODE_BACKUP_KEY);
    return code;
  } catch {
    return null;
  }
}

export function loginRedirect(): void {
  const redirectBack = window.location.href;
  window.location.href = `${getStatelyBaseUrl()}/registry/login?redirectTo=${encodeURIComponent(redirectBack)}`;
}
