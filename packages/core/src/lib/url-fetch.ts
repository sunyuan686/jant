/**
 * Safe remote URL fetching for server-side image sideloading.
 *
 * When an author pastes an article from another site, its `<img>` tags point at
 * remote URLs. To rehost those images into the site's own storage the server
 * must fetch the bytes itself (a browser `fetch` of a third-party image is
 * blocked by CORS for most hosts). Because the URL comes from pasted HTML it is
 * attacker-influenced, so every fetch passes through an SSRF guard and a bounded
 * reader that caps size and time.
 *
 * Note: DNS is not resolvable from a Cloudflare Worker, so the IP-literal checks
 * here are defense-in-depth for self-hosted (Node) deployments and for URLs that
 * embed a literal address. They are not a substitute for network-level egress
 * controls.
 */

import { ValidationError } from "./errors.js";

/** A browser-like UA — many CDNs serving article images block unknown bots. */
const FETCH_USER_AGENT =
  "Mozilla/5.0 (compatible; Jant image sideloader) AppleWebKit/537.36";

export interface FetchedImage {
  bytes: Uint8Array;
  /** Lowercased content-type with parameters stripped, or null if absent. */
  contentType: string | null;
}

export interface FetchImageBytesOptions {
  /** Reject (and abort) once the body exceeds this many bytes. */
  maxBytes: number;
  /** Abort the whole request after this many milliseconds. */
  timeoutMs: number;
  /** Maximum redirect hops to follow (each re-validated). Default 3. */
  maxRedirects?: number;
}

/**
 * Validate that a string is a public http(s) URL safe to fetch server-side.
 *
 * Throws {@link ValidationError} for non-http(s) protocols, embedded
 * credentials, localhost names, and private/loopback/link-local/ULA/CGNAT IP
 * literals (including the `169.254.169.254` cloud-metadata address).
 *
 * @param raw - The candidate URL string
 * @returns The parsed {@link URL}
 * @example
 * ```ts
 * const url = assertPublicHttpUrl("https://example.com/photo.jpg");
 * ```
 */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError("That doesn't look like a valid image URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ValidationError("Only http and https image URLs can be fetched.");
  }
  if (url.username || url.password) {
    throw new ValidationError("Image URLs can't include credentials.");
  }

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    isPrivateIpv4(host) ||
    isPrivateIpv6(host)
  ) {
    throw new ValidationError("That image URL points to a private address.");
  }

  return url;
}

/**
 * Fetch a remote image with an SSRF-checked redirect chain, a size cap, and a
 * timeout. Reads the body in chunks and aborts the moment it exceeds `maxBytes`
 * so an untrusted host can't exhaust memory.
 *
 * @param startUrl - A URL already validated by {@link assertPublicHttpUrl}
 * @param options - Size cap, timeout, and redirect budget
 * @returns The raw bytes and the response content-type
 * @example
 * ```ts
 * const { bytes, contentType } = await fetchImageBytes(url, {
 *   maxBytes: 25 * 1024 * 1024,
 *   timeoutMs: 15000,
 * });
 * ```
 */
export async function fetchImageBytes(
  startUrl: URL,
  options: FetchImageBytesOptions,
): Promise<FetchedImage> {
  const maxRedirects = options.maxRedirects ?? 3;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    let url = startUrl;
    let response: Response | null = null;

    for (let hop = 0; hop <= maxRedirects; hop++) {
      response = await fetch(url.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "image/*,*/*;q=0.8",
          "User-Agent": FETCH_USER_AGENT,
          // Many CDNs (Douban, WeChat, etc.) reject hotlinked image requests
          // that lack a Referer. Sending the image's own origin satisfies the
          // common "referer must be same-site" hotlink check.
          Referer: `${url.origin}/`,
        },
      }).catch((error) => {
        if (controller.signal.aborted) {
          throw new ValidationError("Timed out fetching the image.");
        }
        throw new ValidationError(
          error instanceof Error
            ? `Couldn't fetch the image: ${error.message}`
            : "Couldn't fetch the image.",
        );
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) break; // No target — fall through to the (failing) checks.
        if (hop === maxRedirects) {
          throw new ValidationError("Too many redirects fetching the image.");
        }
        // Re-validate every hop so a redirect can't escape the SSRF guard.
        url = assertPublicHttpUrl(new URL(location, url).toString());
        continue;
      }
      break;
    }

    if (!response) {
      throw new ValidationError("Couldn't fetch the image.");
    }
    if (!response.ok) {
      throw new ValidationError(
        `Couldn't fetch the image (HTTP ${response.status}).`,
      );
    }

    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > options.maxBytes) {
      throw new ValidationError("That image is too large.");
    }

    const contentType = normalizeContentType(
      response.headers.get("content-type"),
    );
    const bytes = await readBounded(response, options.maxBytes);
    return { bytes, contentType };
  } finally {
    clearTimeout(timer);
  }
}

async function readBounded(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  const body = response.body;
  if (!body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new ValidationError("That image is too large.");
    }
    return buffer;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ValidationError("That image is too large.");
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function normalizeContentType(raw: string | null): string | null {
  if (!raw) return null;
  const type = raw.split(";")[0]?.trim().toLowerCase();
  return type || null;
}

/**
 * True when a canonicalized IPv4 dotted-quad host is in a private, loopback,
 * link-local, CGNAT, or otherwise non-public range. The WHATWG URL parser
 * already normalizes decimal/octal/hex IPv4 forms to dotted-quad, so checking
 * `url.hostname` is sufficient.
 */
function isPrivateIpv4(host: string): boolean {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1, 5).map(Number);
  if (octets.some((part) => part > 255)) return true; // Malformed → unsafe.
  const a = octets[0] ?? 0;
  const b = octets[1] ?? 0;
  if (a === 0) return true; // 0.0.0.0/8 "this" network
  if (a === 10) return true; // 10/8 private
  if (a === 127) return true; // 127/8 loopback
  if (a === 169 && b === 254) return true; // 169.254/16 link-local (metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true; // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 255 && b === 255) return true; // broadcast
  return false;
}

/** True when an IPv6 host (bracketed or bare) is loopback/link-local/ULA/mapped-private. */
function isPrivateIpv6(host: string): boolean {
  let inner = host;
  if (inner.startsWith("[") && inner.endsWith("]")) {
    inner = inner.slice(1, -1);
  }
  if (!inner.includes(":")) return false;
  const lower = inner.toLowerCase();
  if (lower === "::" || lower === "::1") return true; // unspecified / loopback

  // IPv4-mapped, dotted form (::ffff:1.2.3.4).
  const dotted = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted?.[1]) return isPrivateIpv4(dotted[1]);

  // IPv4-mapped, hex form (::ffff:a00:1) — what the URL parser normalizes to.
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1] ?? "0", 16);
    const lo = parseInt(hex[2] ?? "0", 16);
    const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isPrivateIpv4(v4);
  }

  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link-local
  if (/^f[cd]/.test(lower)) return true; // fc00::/7 unique local
  return false;
}
