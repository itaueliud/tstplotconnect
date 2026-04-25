"use client";

export type StoredUser = {
  id?: string;
  displayId?: string;
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
};

export type UserSession = {
  token: string;
  user: StoredUser | null;
};

const STORAGE_KEY = "tstplotconnect_user_session";

export function readUserSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserSession;
    if (!parsed?.token) return null;
    return {
      token: parsed.token,
      user: parsed.user || null
    };
  } catch (_error) {
    return null;
  }
}

export function writeUserSession(session: UserSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearUserSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
