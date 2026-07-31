/**
 * One-time state passed from the Collection editor to the Collections page.
 */

export const PENDING_COLLECTION_CREATED_STORAGE_KEY =
  "jant.pendingCollectionCreated";

interface PendingCollectionCreated {
  collectionId: string;
}

function canUseSessionStorage(): boolean {
  try {
    return typeof globalThis.sessionStorage !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Queue a Collection ID so the destination page can show an inline next step.
 *
 * @param collectionId - TypeID of the newly created Collection
 * @returns Nothing
 * @example
 * queueCollectionCreatedNotice("col_01abc");
 */
export function queueCollectionCreatedNotice(collectionId: string): void {
  const normalizedId = collectionId.trim();
  if (!normalizedId || !canUseSessionStorage()) return;

  globalThis.sessionStorage.setItem(
    PENDING_COLLECTION_CREATED_STORAGE_KEY,
    JSON.stringify({
      collectionId: normalizedId,
    } satisfies PendingCollectionCreated),
  );
}

/**
 * Consume the queued Collection ID, clearing it whether or not it is valid.
 *
 * @returns The newly created Collection ID, or null when none is available
 * @example
 * const collectionId = consumeCollectionCreatedNotice();
 */
export function consumeCollectionCreatedNotice(): string | null {
  if (!canUseSessionStorage()) return null;

  const raw = globalThis.sessionStorage.getItem(
    PENDING_COLLECTION_CREATED_STORAGE_KEY,
  );
  if (!raw) return null;

  globalThis.sessionStorage.removeItem(PENDING_COLLECTION_CREATED_STORAGE_KEY);

  try {
    const parsed = JSON.parse(raw) as Partial<PendingCollectionCreated>;
    return typeof parsed.collectionId === "string" &&
      parsed.collectionId.trim().length > 0
      ? parsed.collectionId.trim()
      : null;
  } catch {
    return null;
  }
}
