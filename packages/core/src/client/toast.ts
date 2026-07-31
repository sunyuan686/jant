/**
 * Toast Utility
 *
 * Shared showToast() for all client-side bridge modules.
 * Appends a temporary notification to `#toast-container`.
 */

export type ToastType = "success" | "error";

export interface ToastAction {
  label: string;
  href: string;
}

interface QueuedToast {
  message: string;
  type: ToastType;
  action?: ToastAction;
}

export const QUEUED_TOAST_STORAGE_KEY = "jant.pendingToast";

/** Ensure the toast container is in the top layer (above <dialog> etc.) */
function ensureTopLayer(container: HTMLElement): void {
  if (typeof container.showPopover !== "function") return;

  // Re-promote above any modal dialog that was opened after the toast container.
  if (
    container.matches(":popover-open") &&
    document.querySelector("dialog[open]")
  ) {
    container.hidePopover();
  }

  if (!container.matches(":popover-open")) {
    container.showPopover();
  }
}

function getToastContainer(): HTMLElement | null {
  return document.getElementById("toast-container");
}

function canUseSessionStorage(): boolean {
  try {
    return typeof globalThis.sessionStorage !== "undefined";
  } catch {
    return false;
  }
}

function readQueuedToast(): QueuedToast | null {
  if (!canUseSessionStorage()) return null;

  const raw = globalThis.sessionStorage.getItem(QUEUED_TOAST_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<QueuedToast>;
    if (
      typeof parsed.message !== "string" ||
      (parsed.type !== "success" && parsed.type !== "error")
    ) {
      globalThis.sessionStorage.removeItem(QUEUED_TOAST_STORAGE_KEY);
      return null;
    }

    if (
      parsed.action &&
      (typeof parsed.action.label !== "string" ||
        typeof parsed.action.href !== "string")
    ) {
      globalThis.sessionStorage.removeItem(QUEUED_TOAST_STORAGE_KEY);
      return null;
    }

    return {
      message: parsed.message,
      type: parsed.type,
      action: parsed.action,
    };
  } catch {
    globalThis.sessionStorage.removeItem(QUEUED_TOAST_STORAGE_KEY);
    return null;
  }
}

const TOAST_ICONS = {
  success:
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
  error:
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
};

const COPY_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const CHECK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path d="M20 6 9 17l-5-5"/></svg>';
const TOAST_DURATION_MS = 3000;
const ACTION_TOAST_DURATION_MS = 8000;

/** Build toast inner content using safe DOM APIs (icon is trusted, text uses textContent). */
function setToastContent(
  toast: HTMLElement,
  type: ToastType,
  message: string,
  action?: ToastAction,
): void {
  toast.innerHTML = TOAST_ICONS[type];
  const span = document.createElement("span");
  span.textContent = message;
  toast.appendChild(span);
  if (action) {
    const a = document.createElement("a");
    a.href = action.href;
    a.className = "toast-action";
    a.textContent = action.label;
    toast.appendChild(a);
  }
  if (type === "error" && navigator.clipboard) {
    const btn = document.createElement("button");
    btn.className = "toast-copy";
    btn.setAttribute("aria-label", "Copy error message");
    btn.innerHTML = COPY_ICON;
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(message).then(() => {
        btn.innerHTML = CHECK_ICON;
        setTimeout(() => {
          btn.innerHTML = COPY_ICON;
        }, 1500);
      });
    });
    toast.appendChild(btn);
  }
}

/**
 * Show a toast notification.
 *
 * @param message - Text to display
 * @param type - Visual style: "success" (default) or "error"
 *
 * @example
 * showToast("Saved successfully.");
 * showToast("Something went wrong", "error");
 */
export function showToast(message: string, type: ToastType = "success"): void {
  if (!message) return;

  const container = getToastContainer();
  if (!container) return;

  ensureTopLayer(container);

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  setToastContent(toast, type, message);
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-out");
    toast.addEventListener("animationend", () => toast.remove());
  }, TOAST_DURATION_MS);
}

/**
 * Show a toast with an action link.
 *
 * @param message - Text to display
 * @param action - Action link rendered beside the message
 * @param type - Visual style: "success" (default) or "error"
 *
 * @example
 * showToastWithAction("Post published.", { label: "View", href: "/p/abc" });
 */
export function showToastWithAction(
  message: string,
  action: ToastAction,
  type: ToastType = "success",
): void {
  if (!message) return;

  const container = getToastContainer();
  if (!container) return;

  ensureTopLayer(container);

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  setToastContent(toast, type, message, action);
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-out");
    toast.addEventListener("animationend", () => toast.remove());
  }, ACTION_TOAST_DURATION_MS);
}

/**
 * Show a persistent toast that stays until explicitly dismissed.
 *
 * @param id - Unique identifier for updating/dismissing later
 * @param message - Text to display
 * @param type - Visual style: "success" (default) or "error"
 * @returns The toast element
 *
 * @example
 * showPersistentToast("upload", "Uploading...");
 */
export function showPersistentToast(
  id: string,
  message: string,
  type: ToastType = "success",
): HTMLElement | null {
  const container = getToastContainer();
  if (!container) return null;

  ensureTopLayer(container);

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.id = `toast-${id}`;
  setToastContent(toast, type, message);
  container.appendChild(toast);

  return toast;
}

/**
 * Update the message of an existing persistent toast.
 *
 * @param id - The toast identifier
 * @param message - New message text
 *
 * @example
 * updateToast("upload", "Almost done...");
 */
export function updateToast(id: string, message: string): void {
  const toast = document.getElementById(`toast-${id}`);
  if (!toast) return;

  const span = toast.querySelector("span");
  if (span) span.textContent = message;
}

/**
 * Dismiss a persistent toast with fadeout animation.
 *
 * @param id - The toast identifier
 *
 * @example
 * dismissToast("upload");
 */
export function dismissToast(id: string): void {
  const toast = document.getElementById(`toast-${id}`);
  if (!toast) return;

  toast.classList.add("toast-out");
  toast.addEventListener("animationend", () => toast.remove());
}

/**
 * Replace a persistent toast with an auto-dismissing one.
 *
 * @param id - The toast identifier
 * @param message - New message text
 * @param type - Visual style: "success" (default) or "error"
 *
 * @example
 * replaceWithAutoClose("upload", "Published!", "success");
 */
export function replaceWithAutoClose(
  id: string,
  message: string,
  type: ToastType = "success",
): void {
  const toast = document.getElementById(`toast-${id}`);
  if (!toast) {
    showToast(message, type);
    return;
  }

  toast.className = `toast toast-${type}`;
  toast.replaceChildren();
  setToastContent(toast, type, message);

  setTimeout(() => {
    toast.classList.add("toast-out");
    toast.addEventListener("animationend", () => toast.remove());
  }, TOAST_DURATION_MS);
}

/**
 * Replace a persistent toast with an auto-dismissing one that has an action link.
 *
 * @param id - The toast identifier
 * @param message - New message text
 * @param action - Action link rendered beside the message
 * @param type - Visual style: "success" (default) or "error"
 *
 * @example
 * replaceWithAutoCloseAction("upload", "Post published.", { label: "View", href: "/p/abc" });
 */
export function replaceWithAutoCloseAction(
  id: string,
  message: string,
  action: ToastAction,
  type: ToastType = "success",
): void {
  const toast = document.getElementById(`toast-${id}`);
  if (!toast) {
    showToastWithAction(message, action, type);
    return;
  }

  toast.className = `toast toast-${type}`;
  toast.replaceChildren();
  setToastContent(toast, type, message, action);

  setTimeout(() => {
    toast.classList.add("toast-out");
    toast.addEventListener("animationend", () => toast.remove());
  }, ACTION_TOAST_DURATION_MS);
}

/**
 * Queue a toast to be shown after the next navigation or reload.
 *
 * @param message - Text to display on the next page
 * @param type - Visual style: "success" (default) or "error"
 * @param action - Optional action link rendered on the destination page
 */
export function queueToastForNextPage(
  message: string,
  type: ToastType = "success",
  action?: ToastAction,
): void {
  if (!message || !canUseSessionStorage()) return;

  globalThis.sessionStorage.setItem(
    QUEUED_TOAST_STORAGE_KEY,
    JSON.stringify({ message, type, action } satisfies QueuedToast),
  );
}

/**
 * Show a queued toast, if one exists for the current page load.
 *
 * @returns True when a queued toast was consumed
 */
export function consumeQueuedToast(): boolean {
  const queued = readQueuedToast();
  if (!queued || !getToastContainer()) return false;

  globalThis.sessionStorage.removeItem(QUEUED_TOAST_STORAGE_KEY);

  if (queued.action) {
    showToastWithAction(queued.message, queued.action, queued.type);
  } else {
    showToast(queued.message, queued.type);
  }

  return true;
}

function initQueuedToastConsumer(): void {
  const showQueuedToast = () => {
    consumeQueuedToast();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showQueuedToast, {
      once: true,
    });
    return;
  }

  showQueuedToast();
}

initQueuedToastConsumer();
