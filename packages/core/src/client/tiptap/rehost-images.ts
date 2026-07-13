/**
 * Rehost-on-paste plugin for inline images.
 *
 * When an author pastes article HTML, its `<img>` tags become image nodes whose
 * `src` still points at the original remote URL (or is an inline `data:` URL).
 * This extension detects those nodes after a paste and asks the host to rehost
 * them into the site's own storage, swapping the node's `src` to the stored URL.
 *
 * It only schedules work — the actual upload/swap happens in the host callback
 * (see `jant-compose-editor`), tracked by the shared inline-image registry so
 * submit waits for it. The remote URL stays visible as an instant preview until
 * the swap completes; on failure the node keeps its original src.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface RehostImagesOptions {
  /** Returns true when an image src should be rehosted (remote/data, not ours). */
  shouldRehost?: (src: string) => boolean;
  /** Starts rehosting the given src. Must call clearRehostInFlight when settled. */
  rehost?: (src: string) => void;
}

/**
 * Generous per-paste cap. Beyond this, extra images are left as external links
 * (and logged) rather than firing an unbounded number of fetches at once.
 */
const REHOST_MAX_PER_DOC = 50;

const rehostImagesKey = new PluginKey("jantRehostImages");

/**
 * Srcs currently being rehosted, deduped so repeated transactions (e.g. typing
 * after a paste, or the src-swap itself) don't re-trigger the same work.
 */
const rehostInFlight = new Set<string>();

/**
 * Release a src once its rehost has settled, so an identical URL pasted later
 * can be rehosted again.
 *
 * @param src - The placeholder src that was being rehosted
 */
export function clearRehostInFlight(src: string): void {
  rehostInFlight.delete(src);
}

export const RehostImages = Extension.create<RehostImagesOptions>({
  name: "rehostImages",

  addOptions() {
    return {
      shouldRehost: undefined,
      rehost: undefined,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: rehostImagesKey,
        appendTransaction(transactions, _oldState, newState) {
          if (
            !transactions.some((tr) => tr.docChanged && tr.getMeta("paste"))
          ) {
            return null;
          }
          const { shouldRehost, rehost } = options;
          if (!shouldRehost || !rehost) return null;

          const candidates: string[] = [];
          const seen = new Set<string>();
          newState.doc.descendants((node) => {
            if (node.type.name !== "image") return;
            const src = node.attrs.src;
            if (typeof src !== "string" || !src) return;
            if (seen.has(src) || rehostInFlight.has(src)) return;
            if (!shouldRehost(src)) return;
            seen.add(src);
            candidates.push(src);
          });

          if (candidates.length === 0) return null;

          const accepted = candidates.slice(0, REHOST_MAX_PER_DOC);
          const dropped = candidates.length - accepted.length;
          if (dropped > 0) {
            // eslint-disable-next-line no-console -- surface a silently-skipped cap
            console.warn(
              `[jant] ${dropped} pasted image(s) left as external links — ` +
                `per-paste rehost cap of ${REHOST_MAX_PER_DOC} reached.`,
            );
          }

          for (const src of accepted) {
            rehostInFlight.add(src);
            queueMicrotask(() => rehost(src));
          }

          // We only schedule side effects; the doc isn't modified here.
          return null;
        },
      }),
    ];
  },
});
