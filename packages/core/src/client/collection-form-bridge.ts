/**
 * Collection Form Bridge
 *
 * Handles full-page collection editor submissions.
 * Quick-create flows inside compose and timeline intercept the same event
 * locally, so only page-level forms reach this bridge.
 */

import type { CollectionSubmitDetail } from "./components/collection-types.js";
import type { JantCollectionForm } from "./components/jant-collection-form.js";
import {
  getCollectionPagePath,
  getCollectionSelectionPath,
  getCollectionsDirectoryPath,
} from "../lib/collection-paths.js";
import { publicPath } from "./runtime-paths.js";
import { queueCollectionCreatedNotice } from "./collection-created-notice.js";
import { showToast } from "./toast.js";

function normalizeLocalHref(href: string): URL | null {
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url;
  } catch {
    return null;
  }
}

function getSitePathPrefix(): string {
  return document.documentElement.dataset.sitePathPrefix || "";
}

function toInternalPath(pathname: string): string | null {
  const sitePathPrefix = getSitePathPrefix();
  if (!sitePathPrefix) return pathname || "/";
  if (pathname === sitePathPrefix) return "/";
  if (pathname.startsWith(`${sitePathPrefix}/`)) {
    return pathname.slice(sitePathPrefix.length) || "/";
  }
  return null;
}

function replaceCollectionSelectionSlug(
  slugExpression: string,
  nextSlug: string,
  currentSlug: string | undefined,
): string {
  const slugs = slugExpression.split("+").filter(Boolean);
  if (slugs.length === 0) {
    return nextSlug;
  }

  if (slugs.length === 1) {
    return nextSlug;
  }

  if (!currentSlug) {
    return slugExpression;
  }

  let replaced = false;
  const nextSlugs = slugs.map((slug) => {
    if (slug !== currentSlug) {
      return slug;
    }

    replaced = true;
    return nextSlug;
  });

  return replaced ? nextSlugs.join("+") : slugExpression;
}

function resolveRedirectUrl(
  detail: CollectionSubmitDetail,
  formEl: JantCollectionForm,
  nextSlug: string | undefined,
): string {
  const fallbackUrl =
    formEl.cancelHref || publicPath(getCollectionsDirectoryPath());
  if (!detail.isEdit) {
    return fallbackUrl;
  }

  if (!nextSlug) {
    return fallbackUrl;
  }

  const cancelUrl = normalizeLocalHref(fallbackUrl);
  if (!cancelUrl) {
    return publicPath(getCollectionPagePath(nextSlug));
  }

  const internalPath = toInternalPath(cancelUrl.pathname);
  const currentSlug = formEl.initial?.slug?.trim() || undefined;
  if (currentSlug && internalPath === getCollectionPagePath(currentSlug)) {
    cancelUrl.pathname = publicPath(getCollectionPagePath(nextSlug));
    return `${cancelUrl.pathname}${cancelUrl.search}${cancelUrl.hash}`;
  }

  const selectionMatch = internalPath?.match(/^\/collections\/([^/]+)$/);
  if (!selectionMatch) {
    return `${cancelUrl.pathname}${cancelUrl.search}${cancelUrl.hash}`;
  }

  const nextSelection = replaceCollectionSelectionSlug(
    selectionMatch[1],
    nextSlug,
    currentSlug,
  );

  cancelUrl.pathname = publicPath(getCollectionSelectionPath(nextSelection));
  return `${cancelUrl.pathname}${cancelUrl.search}${cancelUrl.hash}`;
}

document.addEventListener("jant:collection-submit", async (event: Event) => {
  const customEvent = event as CustomEvent<CollectionSubmitDetail>;
  const detail = customEvent.detail;
  const formEl =
    customEvent.target instanceof HTMLElement
      ? (customEvent.target as JantCollectionForm)
      : document.querySelector<JantCollectionForm>("jant-collection-form");
  const pageRoot = formEl?.closest<HTMLElement>(
    "[data-collection-editor-page]",
  );

  if (!detail?.endpoint || !formEl || !pageRoot) return;

  formEl.loading = true;

  try {
    const res = await fetch(detail.endpoint, {
      method: detail.isEdit ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(detail.data),
    });
    const json = (await res.json().catch(() => null)) as {
      id?: string;
      slug?: string;
      error?: string;
    } | null;

    if (!res.ok) {
      throw new Error(
        json?.error ||
          pageRoot.dataset.collectionEditorSaveFailed ||
          "Couldn't save. Try again in a moment.",
      );
    }

    const redirectUrl = resolveRedirectUrl(
      detail,
      formEl,
      typeof json?.slug === "string" && json.slug.length > 0
        ? json.slug
        : undefined,
    );

    if (!detail.isEdit) {
      const collectionId =
        typeof json?.id === "string" && json.id.length > 0
          ? json.id
          : undefined;
      const destination = normalizeLocalHref(redirectUrl);
      const destinationPath = destination
        ? toInternalPath(destination.pathname)
        : null;

      if (collectionId && destinationPath === getCollectionsDirectoryPath()) {
        queueCollectionCreatedNotice(collectionId);
      }
    }

    window.location.href = redirectUrl;
    return;
  } catch (error) {
    showToast(
      error instanceof Error
        ? error.message
        : pageRoot.dataset.collectionEditorSaveFailed ||
            "Couldn't save. Try again in a moment.",
      "error",
    );
  } finally {
    formEl.loading = false;
  }
});
