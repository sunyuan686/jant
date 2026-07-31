const NON_FEED_PATH_PREFIXES = ["/api", "/settings", "/compose", "/_"];

function hasPathPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Check whether an internal application path is an Atom feed endpoint.
 *
 * @param path - Request pathname after any configured site prefix is removed
 * @returns Whether the path is a canonical or legacy feed URL
 * @example
 * ```ts
 * isRssFeedPath("/reading/feed"); // true
 * isRssFeedPath("/api/posts"); // false
 * ```
 */
export function isRssFeedPath(path: string): boolean {
  if (path === "/feed" || path.startsWith("/feed/")) return true;
  if (NON_FEED_PATH_PREFIXES.some((prefix) => hasPathPrefix(path, prefix))) {
    return false;
  }

  return path.endsWith("/feed") || path.endsWith("/feed/atom.xml");
}
