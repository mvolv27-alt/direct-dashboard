const USER_SCOPE_EVENT = "direct:user-scope-changed";

let activeUserId = "";
let activeUserEmail = "";

const LEGACY_OWNER_EMAIL = (
  import.meta.env.VITE_LEGACY_OWNER_EMAIL || "mvolv27@gmail.com"
).toLowerCase();

export function setActiveUserScope(
  userId: string | null | undefined,
  userEmail?: string | null,
) {
  const next = userId || "";
  const previous = activeUserId;
  activeUserId = next;
  if (userEmail !== undefined) activeUserEmail = (userEmail || "").toLowerCase();
  if (!next) activeUserEmail = "";
  if (previous !== next && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(USER_SCOPE_EVENT, { detail: { userId: next } }));
  }
}

export function getActiveUserId() {
  return activeUserId;
}

export function requireActiveUserId() {
  if (!activeUserId) throw new Error("Usuário autenticado não encontrado");
  return activeUserId;
}

export function canAdoptLegacyStorage() {
  return !!activeUserId && activeUserEmail === LEGACY_OWNER_EMAIL;
}

export function scopedStorageKey(baseKey: string) {
  return `${baseKey}::user:${activeUserId || "anonymous"}`;
}

export function adoptLegacyStorage(keys: string[]) {
  if (!canAdoptLegacyStorage() || typeof localStorage === "undefined") return;
  for (const legacyKey of keys) {
    const scopedKey = scopedStorageKey(legacyKey);
    const legacyValue = localStorage.getItem(legacyKey);
    if (localStorage.getItem(scopedKey) === null && legacyValue !== null) {
      localStorage.setItem(scopedKey, legacyValue);
    }
    if (legacyValue !== null) localStorage.removeItem(legacyKey);
  }
}

export { USER_SCOPE_EVENT };
