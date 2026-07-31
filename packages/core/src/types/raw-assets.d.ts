/**
 * Ambient declarations for Vite's `?raw` query suffix on asset imports.
 *
 * Vite (and our worker bundle build) inlines the file contents as a
 * UTF-8 string at build time. We use this for shipping CSS, HTML
 * templates, and TOML manifests into the Hugo export bundle without
 * requiring filesystem access at runtime.
 */
declare module "*.css?raw" {
  const content: string;
  export default content;
}

declare module "*.html?raw" {
  const content: string;
  export default content;
}

declare module "*.toml?raw" {
  const content: string;
  export default content;
}

declare module "*.js?raw" {
  const content: string;
  export default content;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}

declare module "*.xml?raw" {
  const content: string;
  export default content;
}

/**
 * Ambient declaration for bare `.css` side-effect imports. Vite injects the
 * stylesheet into the bundle output; at the type level, these imports have
 * no runtime value.
 */
declare module "*.css";
