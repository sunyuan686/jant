import { base64ToUint8Array } from "./favicon.js";
import { strToU8, zipSync } from "fflate";
import {
  JANT_APP_ICON_CORNER_RADIUS,
  JANT_APP_ICON_SVG,
  JANT_BRAND_TILE_512_PNG_BASE64,
  JANT_CIRCLE_TILE_512_PNG_BASE64,
  JANT_CIRCLE_TILE_SVG,
  JANT_DEFAULT_APPLE_TOUCH_ICON_PNG_BASE64,
  JANT_DEFAULT_FAVICON_ICO_BASE64,
  JANT_DEFAULT_SOCIAL_IMAGE_PNG_BASE64,
  JANT_LOGO_NEGATIVE_FILL,
  JANT_LOGO_NEGATIVE_SVG,
  JANT_LOGO_PATH_DATA,
  JANT_LOGO_POSITIVE_512_PNG_BASE64,
  JANT_LOGO_POSITIVE_FILL,
  JANT_LOGO_POSITIVE_SVG,
  JANT_LOGO_VIEW_BOX,
  JANT_SQUARE_TILE_512_PNG_BASE64,
  JANT_SQUARE_TILE_SVG,
} from "./jant-branding-generated.js";
import { toPublicPath } from "./url.js";

export { JANT_APP_ICON_CORNER_RADIUS, JANT_LOGO_PATH_DATA, JANT_LOGO_VIEW_BOX };

export const JANT_HOME_URL = "https://jant.me";
export const JANT_REPO_URL = "https://github.com/jant-me/jant";
export const HOME_BRANDING_PREFIX = "Build with";
export const HOME_BRANDING_LINK_LABEL = "Jant";
export const HOME_BRANDING_TEXT = `${HOME_BRANDING_PREFIX} ${HOME_BRANDING_LINK_LABEL}`;

export const JANT_BRAND_ASSET_BASE_PATH = "/_/brand/assets";

export const JANT_LOGO_FILLS = {
  positive: JANT_LOGO_POSITIVE_FILL,
  negative: JANT_LOGO_NEGATIVE_FILL,
} as const;

export const JANT_APP_ICON_BACKGROUND = JANT_LOGO_FILLS.positive;

export const JANT_LOGO_FILENAMES = {
  positive: "jant-logo-positive.svg",
  negative: "jant-logo-negative.svg",
} as const;

export const JANT_POSITIVE_LOGO_PNG_FILENAME = "jant-logo-positive-512.png";
export const JANT_BRAND_PACK_FILENAME = "jant-brand-assets.zip";
const JANT_LEGACY_APP_ICON_SVG_FILENAME = "jant-app-icon.svg";

export const JANT_ICON_FILENAMES = {
  brandTileSvg: "jant-brand-tile.svg",
  brandTilePng: "jant-brand-tile-512.png",
  squareTileSvg: "jant-square-tile.svg",
  squareTilePng: "jant-square-tile-512.png",
  circleTileSvg: "jant-circle-tile.svg",
  circleTilePng: "jant-circle-tile-512.png",
  favicon: "jant-favicon.ico",
  appleTouch: "jant-apple-touch-icon.png",
  socialImage: "jant-social-preview.png",
} as const;

export type JantLogoVariant = keyof typeof JANT_LOGO_FILENAMES;
export type JantIconAsset = keyof typeof JANT_ICON_FILENAMES;

interface JantBundledAsset {
  body: string | Uint8Array;
  contentType: string;
}

interface JantBrandAssetDefinition {
  logoFills: Record<JantLogoVariant, string>;
  logoSvg: Record<JantLogoVariant, string>;
  appIconSvg: string;
  brandTilePngBase64: string;
  squareTileSvg: string;
  squareTilePngBase64: string;
  circleTileSvg: string;
  circleTilePngBase64: string;
  faviconIcoBase64: string;
  appleTouchPngBase64: string;
  socialImagePngBase64: string;
  positiveLogoPngBase64: string;
}

let cachedJantBrandPackBytes: Uint8Array | null = null;

const JANT_BRAND_ASSET_DEFINITIONS: Record<
  "default",
  JantBrandAssetDefinition
> = {
  default: {
    logoFills: {
      positive: JANT_LOGO_POSITIVE_FILL,
      negative: JANT_LOGO_NEGATIVE_FILL,
    },
    logoSvg: {
      positive: JANT_LOGO_POSITIVE_SVG,
      negative: JANT_LOGO_NEGATIVE_SVG,
    },
    appIconSvg: JANT_APP_ICON_SVG,
    brandTilePngBase64: JANT_BRAND_TILE_512_PNG_BASE64,
    squareTileSvg: JANT_SQUARE_TILE_SVG,
    squareTilePngBase64: JANT_SQUARE_TILE_512_PNG_BASE64,
    circleTileSvg: JANT_CIRCLE_TILE_SVG,
    circleTilePngBase64: JANT_CIRCLE_TILE_512_PNG_BASE64,
    faviconIcoBase64: JANT_DEFAULT_FAVICON_ICO_BASE64,
    appleTouchPngBase64: JANT_DEFAULT_APPLE_TOUCH_ICON_PNG_BASE64,
    socialImagePngBase64: JANT_DEFAULT_SOCIAL_IMAGE_PNG_BASE64,
    positiveLogoPngBase64: JANT_LOGO_POSITIVE_512_PNG_BASE64,
  },
};

function getJantBrandAssetDefinition(): JantBrandAssetDefinition {
  return JANT_BRAND_ASSET_DEFINITIONS.default;
}

export function getJantLogoFills(): Record<JantLogoVariant, string> {
  return getJantBrandAssetDefinition().logoFills;
}

/**
 * Resolve the canonical filename for a bundled Jant logo variant.
 *
 * @param variant - Which logo variant to resolve
 * @returns Stable SVG filename for downloads and raw asset links
 *
 * @example
 * ```ts
 * getJantLogoFilename("positive"); // "jant-logo-positive.svg"
 * ```
 */
export function getJantLogoFilename(variant: JantLogoVariant): string {
  return JANT_LOGO_FILENAMES[variant];
}

/**
 * Resolve the public URL for a bundled Jant logo asset.
 *
 * @param variant - Which logo variant to link to
 * @param sitePathPrefix - Optional configured site path prefix
 * @returns Public path to the SVG asset
 *
 * @example
 * ```ts
 * getJantLogoHref("negative", "/blog");
 * // "/blog/_/brand/assets/jant-logo-negative.svg"
 * ```
 */
export function getJantLogoHref(
  variant: JantLogoVariant,
  sitePathPrefix = "",
): string {
  return toPublicPath(
    `${JANT_BRAND_ASSET_BASE_PATH}/${getJantLogoFilename(variant)}`,
    sitePathPrefix,
  );
}

/**
 * Resolve the canonical filename for a bundled Jant square/icon asset.
 *
 * @param asset - Which icon asset to resolve
 * @returns Stable filename for downloads and raw asset links
 *
 * @example
 * ```ts
 * getJantIconFilename("brandTileSvg"); // "jant-brand-tile.svg"
 * ```
 */
export function getJantIconFilename(asset: JantIconAsset): string {
  return JANT_ICON_FILENAMES[asset];
}

/**
 * Resolve the public URL for a bundled Jant square/icon asset.
 *
 * @param asset - Which icon asset to link to
 * @param sitePathPrefix - Optional configured site path prefix
 * @returns Public path to the asset
 *
 * @example
 * ```ts
 * getJantIconHref("brandTilePng", "/blog");
 * // "/blog/_/brand/assets/jant-brand-tile-512.png"
 * ```
 */
export function getJantIconHref(
  asset: JantIconAsset,
  sitePathPrefix = "",
): string {
  return toPublicPath(
    `${JANT_BRAND_ASSET_BASE_PATH}/${getJantIconFilename(asset)}`,
    sitePathPrefix,
  );
}

/**
 * Resolve the public URL for the bundled positive logo PNG.
 *
 * @param sitePathPrefix - Optional configured site path prefix
 * @returns Public path to the transparent PNG asset
 *
 * @example
 * ```ts
 * getJantPositiveLogoPngHref("/blog");
 * // "/blog/_/brand/assets/jant-logo-positive-512.png"
 * ```
 */
export function getJantPositiveLogoPngHref(sitePathPrefix = ""): string {
  return toPublicPath(
    `${JANT_BRAND_ASSET_BASE_PATH}/${JANT_POSITIVE_LOGO_PNG_FILENAME}`,
    sitePathPrefix,
  );
}

/**
 * Resolve the public URL for the bundled brand pack ZIP.
 *
 * @param sitePathPrefix - Optional configured site path prefix
 * @returns Public path to the ZIP archive
 */
export function getJantBrandPackHref(sitePathPrefix = ""): string {
  return toPublicPath(
    `${JANT_BRAND_ASSET_BASE_PATH}/${JANT_BRAND_PACK_FILENAME}`,
    sitePathPrefix,
  );
}

/**
 * Map a requested SVG filename back to the corresponding logo variant.
 *
 * @param filename - Requested SVG filename
 * @returns Matching logo variant when known, otherwise `null`
 *
 * @example
 * ```ts
 * getJantLogoVariantForFilename("jant-logo-positive.svg"); // "positive"
 * ```
 */
export function getJantLogoVariantForFilename(
  filename: string,
): JantLogoVariant | null {
  if (filename === JANT_LOGO_FILENAMES.positive) {
    return "positive";
  }

  if (filename === JANT_LOGO_FILENAMES.negative) {
    return "negative";
  }

  return null;
}

/**
 * Render the raw Jant logo SVG markup for direct download responses.
 *
 * @param variant - Which logo variant to render
 * @returns SVG markup string with the baked-in fill color
 *
 * @example
 * ```ts
 * buildJantLogoSvgMarkup("positive");
 * ```
 */
export function buildJantLogoSvgMarkup(variant: JantLogoVariant): string {
  return getJantBrandAssetDefinition().logoSvg[variant];
}

/**
 * Render the filled square Jant app icon SVG.
 *
 * @returns SVG markup string with the baked-in background tile
 *
 * @example
 * ```ts
 * buildJantAppIconSvgMarkup();
 * ```
 */
export function buildJantAppIconSvgMarkup(): string {
  return getJantBrandAssetDefinition().appIconSvg;
}

/**
 * Render the hard-edge square Jant tile SVG.
 *
 * @returns SVG markup string with the baked-in square tile
 */
export function buildJantSquareTileSvgMarkup(): string {
  return getJantBrandAssetDefinition().squareTileSvg;
}

/**
 * Render the circular Jant tile SVG.
 *
 * @returns SVG markup string with the baked-in circular tile
 */
export function buildJantCircleTileSvgMarkup(): string {
  return getJantBrandAssetDefinition().circleTileSvg;
}

/**
 * Decode the bundled ICO fallback used when the site has no uploaded avatar.
 *
 * @returns ICO bytes
 */
export function getDefaultJantFaviconIcoBytes(): Uint8Array {
  return base64ToUint8Array(getJantBrandAssetDefinition().faviconIcoBase64);
}

/**
 * Decode the bundled apple-touch-icon fallback used when the site has no uploaded avatar.
 *
 * @returns PNG bytes
 */
export function getDefaultJantAppleTouchIconBytes(): Uint8Array {
  return base64ToUint8Array(getJantBrandAssetDefinition().appleTouchPngBase64);
}

/**
 * Decode the bundled branded PNG used as the default metadata image.
 *
 * @returns PNG bytes
 */
export function getDefaultJantSocialImageBytes(): Uint8Array {
  return base64ToUint8Array(getJantBrandAssetDefinition().socialImagePngBase64);
}

/**
 * Decode the bundled square brand tile PNG with the Jant green background.
 *
 * @returns PNG bytes
 */
export function getDefaultJantBrandTilePngBytes(): Uint8Array {
  return base64ToUint8Array(getJantBrandAssetDefinition().brandTilePngBase64);
}

/**
 * Decode the bundled hard-edge square Jant tile PNG.
 *
 * @returns PNG bytes
 */
export function getDefaultJantSquareTilePngBytes(): Uint8Array {
  return base64ToUint8Array(getJantBrandAssetDefinition().squareTilePngBase64);
}

/**
 * Decode the bundled circular Jant tile PNG.
 *
 * @returns PNG bytes
 */
export function getDefaultJantCircleTilePngBytes(): Uint8Array {
  return base64ToUint8Array(getJantBrandAssetDefinition().circleTilePngBase64);
}

/**
 * Decode the bundled transparent positive logo PNG.
 *
 * @returns PNG bytes
 */
export function getDefaultJantPositiveLogoPngBytes(): Uint8Array {
  return base64ToUint8Array(
    getJantBrandAssetDefinition().positiveLogoPngBase64,
  );
}

function buildJantBrandPackReadme(): string {
  return [
    "Jant Brand Assets",
    "",
    "Included files:",
    "- logos/jant-logo.svg",
    "- logos/jant-reverse-logo.svg",
    "- logos/jant-square-logo.png",
    "- icons/jant-brand-tile.svg",
    "- icons/jant-brand-tile-512.png",
    "- icons/jant-square-tile.svg",
    "- icons/jant-square-tile-512.png",
    "- icons/jant-circle-tile.svg",
    "- icons/jant-circle-tile-512.png",
    "- icons/jant-favicon.ico",
    "- icons/jant-apple-touch-icon.png",
    "- social/jant-social-preview.png",
    "",
    "Basic usage:",
    "- Use the main logo on light or neutral backgrounds.",
    "- Use the reverse logo on dark backgrounds.",
    "- Do not stretch, recolor, rotate, or add effects to the logo.",
    "",
    `Source: ${JANT_REPO_URL}`,
  ].join("\n");
}

/**
 * Decode the bundled ZIP archive that contains the public brand asset pack.
 *
 * @returns ZIP bytes
 */
export function getDefaultJantBrandPackBytes(): Uint8Array {
  if (!cachedJantBrandPackBytes) {
    cachedJantBrandPackBytes = zipSync(
      {
        "README.txt": strToU8(buildJantBrandPackReadme()),
        "logos/jant-logo.svg": strToU8(buildJantLogoSvgMarkup("positive")),
        "logos/jant-reverse-logo.svg": strToU8(
          buildJantLogoSvgMarkup("negative"),
        ),
        "logos/jant-square-logo.png": getDefaultJantPositiveLogoPngBytes(),
        "icons/jant-brand-tile.svg": strToU8(buildJantAppIconSvgMarkup()),
        "icons/jant-brand-tile-512.png": getDefaultJantBrandTilePngBytes(),
        "icons/jant-square-tile.svg": strToU8(buildJantSquareTileSvgMarkup()),
        "icons/jant-square-tile-512.png": getDefaultJantSquareTilePngBytes(),
        "icons/jant-circle-tile.svg": strToU8(buildJantCircleTileSvgMarkup()),
        "icons/jant-circle-tile-512.png": getDefaultJantCircleTilePngBytes(),
        "icons/jant-favicon.ico": getDefaultJantFaviconIcoBytes(),
        "icons/jant-apple-touch-icon.png": getDefaultJantAppleTouchIconBytes(),
        "social/jant-social-preview.png": getDefaultJantSocialImageBytes(),
      },
      { level: 0 },
    );
  }

  return cachedJantBrandPackBytes;
}

/**
 * Resolve any bundled brand asset by filename for download routes.
 *
 * @param filename - Requested asset filename
 * @returns Asset body and content type when known, otherwise `null`
 */
export function getJantBundledAsset(filename: string): JantBundledAsset | null {
  const logoVariant = getJantLogoVariantForFilename(filename);
  if (logoVariant) {
    return {
      body: buildJantLogoSvgMarkup(logoVariant),
      contentType: "image/svg+xml; charset=utf-8",
    };
  }

  if (
    filename === JANT_ICON_FILENAMES.brandTileSvg ||
    filename === JANT_LEGACY_APP_ICON_SVG_FILENAME
  ) {
    return {
      body: buildJantAppIconSvgMarkup(),
      contentType: "image/svg+xml; charset=utf-8",
    };
  }

  if (filename === JANT_ICON_FILENAMES.brandTilePng) {
    return {
      body: getDefaultJantBrandTilePngBytes(),
      contentType: "image/png",
    };
  }

  if (filename === JANT_ICON_FILENAMES.squareTileSvg) {
    return {
      body: buildJantSquareTileSvgMarkup(),
      contentType: "image/svg+xml; charset=utf-8",
    };
  }

  if (filename === JANT_ICON_FILENAMES.squareTilePng) {
    return {
      body: getDefaultJantSquareTilePngBytes(),
      contentType: "image/png",
    };
  }

  if (filename === JANT_ICON_FILENAMES.circleTileSvg) {
    return {
      body: buildJantCircleTileSvgMarkup(),
      contentType: "image/svg+xml; charset=utf-8",
    };
  }

  if (filename === JANT_ICON_FILENAMES.circleTilePng) {
    return {
      body: getDefaultJantCircleTilePngBytes(),
      contentType: "image/png",
    };
  }

  if (filename === JANT_ICON_FILENAMES.favicon) {
    return {
      body: getDefaultJantFaviconIcoBytes(),
      contentType: "image/x-icon",
    };
  }

  if (filename === JANT_ICON_FILENAMES.appleTouch) {
    return {
      body: getDefaultJantAppleTouchIconBytes(),
      contentType: "image/png",
    };
  }

  if (filename === JANT_ICON_FILENAMES.socialImage) {
    return {
      body: getDefaultJantSocialImageBytes(),
      contentType: "image/png",
    };
  }

  if (filename === JANT_POSITIVE_LOGO_PNG_FILENAME) {
    return {
      body: getDefaultJantPositiveLogoPngBytes(),
      contentType: "image/png",
    };
  }

  if (filename === JANT_BRAND_PACK_FILENAME) {
    return {
      body: getDefaultJantBrandPackBytes(),
      contentType: "application/zip",
    };
  }

  return null;
}
