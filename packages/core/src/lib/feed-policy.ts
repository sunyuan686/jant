import type { Post } from "../types.js";
import { now, toISOString } from "./time.js";

/** Cache policy for dynamic Atom feed responses. */
export const RSS_FEED_CACHE_CONTROL = "public, max-age=60";

/**
 * Convert an RSS publication delay into the exclusive upper bound expected by
 * Post service queries.
 *
 * Posts published exactly `delaySeconds` ago are eligible. Because publication
 * timestamps use whole seconds while `publishedBefore` is exclusive, the bound
 * is one second after the latest eligible timestamp.
 *
 * @param delaySeconds - Non-negative publication delay in seconds
 * @param currentTime - Current Unix timestamp, injectable for deterministic use
 * @returns Exclusive `publishedBefore` timestamp for RSS queries
 * @example
 * ```ts
 * getRssPublishedBefore(300, 1_000); // 701, so publishedAt <= 700 is eligible
 * ```
 */
export function getRssPublishedBefore(
  delaySeconds: number,
  currentTime = now(),
): number {
  return currentTime - delaySeconds + 1;
}

/**
 * Resolve the Atom `updated` timestamp for a Thread entry from content that is
 * actually present in the feed.
 *
 * @param root - Thread root used as a fallback when no Thread rows are loaded
 * @param thread - Eligible Thread Posts included in the Atom entry
 * @param additionalTimestamps - Other entry updates, such as Collection membership
 * @returns Latest update timestamp as an ISO 8601 string
 * @example
 * ```ts
 * getFeedEntryUpdatedAt(root, [root, reply], [collectedAt]);
 * ```
 */
export function getFeedEntryUpdatedAt(
  root: Pick<Post, "publishedAt" | "updatedAt">,
  thread: readonly Pick<Post, "publishedAt" | "updatedAt">[] | undefined,
  additionalTimestamps: readonly (number | null | undefined)[] = [],
): string {
  let updatedAt = Math.max(root.updatedAt, root.publishedAt ?? root.updatedAt);

  for (const post of thread ?? []) {
    updatedAt = Math.max(
      updatedAt,
      post.updatedAt,
      post.publishedAt ?? post.updatedAt,
    );
  }
  for (const timestamp of additionalTimestamps) {
    if (timestamp !== null && timestamp !== undefined) {
      updatedAt = Math.max(updatedAt, timestamp);
    }
  }

  return toISOString(updatedAt);
}
