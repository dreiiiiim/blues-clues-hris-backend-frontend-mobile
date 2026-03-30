const APPLICANT_APPS_DIRTY_KEY = "applicantApplicationsDirtyAt";
const APPLICANT_APPS_DIRTY_EVENT = "applicant-applications-dirty";

// Temporary client-side invalidation hook until backend push invalidation exists.
export function emitApplicantApplicationsDirty(reason: "applied" | "updated" = "updated") {
  if (!globalThis.window) return;

  const payload = { at: Date.now(), reason };

  try {
    globalThis.localStorage.setItem(APPLICANT_APPS_DIRTY_KEY, String(payload.at));
  } catch {
    // No-op when storage is unavailable.
  }

  globalThis.dispatchEvent(new CustomEvent(APPLICANT_APPS_DIRTY_EVENT, { detail: payload }));
}

export function subscribeApplicantApplicationsDirty(onDirty: () => void | Promise<void>) {
  if (!globalThis.window) return () => {};

  const run = () => {
    void Promise.resolve(onDirty()).catch(() => {
      // Keep sync channel resilient even if a subscriber refresh fails.
    });
  };

  const handleCustom = () => run();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === APPLICANT_APPS_DIRTY_KEY) run();
  };

  globalThis.addEventListener(APPLICANT_APPS_DIRTY_EVENT, handleCustom);
  globalThis.addEventListener("storage", handleStorage);

  return () => {
    globalThis.removeEventListener(APPLICANT_APPS_DIRTY_EVENT, handleCustom);
    globalThis.removeEventListener("storage", handleStorage);
  };
}
