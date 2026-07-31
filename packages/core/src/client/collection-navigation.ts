/**
 * Shared client-side helpers for adding Collections to site navigation.
 */

import { getJsonString, readJsonObject } from "./json.js";
import { applySiteHeaderHtml } from "./site-header-fragment.js";

const SITE_HEADER_REQUEST_HEADER = "X-Jant-Site-Header";
const INCLUDE_SITE_HEADER_RESPONSE = "include";

/**
 * Add a Collection to the end of the primary navigation and refresh the
 * rendered site header when the server returns a fragment.
 *
 * @param collectionId - TypeID of the Collection to add
 * @returns The created navigation item ID when present
 * @example
 * const navItemId = await addCollectionToNavigation("col_01abc");
 */
export async function addCollectionToNavigation(
  collectionId: string,
): Promise<string | undefined> {
  const response = await fetch("/api/nav-items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      [SITE_HEADER_REQUEST_HEADER]: INCLUDE_SITE_HEADER_RESPONSE,
    },
    body: JSON.stringify({
      type: "collection",
      collectionId,
      placement: "header",
    }),
  });
  const body = await readJsonObject(response);

  if (!response.ok) {
    throw new Error(getJsonString(body, "error") ?? `HTTP ${response.status}`);
  }

  applySiteHeaderHtml(getJsonString(body, "headerHtml"));
  return getJsonString(body, "id");
}
