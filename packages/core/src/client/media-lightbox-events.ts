export const MEDIA_LIGHTBOX_TOGGLE_EVENT = "jant:media-lightbox-toggle";

export const MEDIA_VIDEO_PLAYBACK_INTENT_EVENT =
  "jant:media-video-playback-intent";

export interface MediaVideoPlaybackIntentDetail {
  mediaId: string;
  paused: boolean;
}

const manuallyPausedMediaIds = new Set<string>();

/**
 * Check whether the user explicitly paused a media item on this page.
 *
 * @param mediaId - Stable media ID to inspect
 * @returns `true` when the media should remain paused
 *
 * @example
 * ```ts
 * isMediaVideoPlaybackPaused("med_123");
 * ```
 */
export function isMediaVideoPlaybackPaused(
  mediaId: string | undefined,
): boolean {
  const normalizedMediaId = mediaId?.trim();
  return !!normalizedMediaId && manuallyPausedMediaIds.has(normalizedMediaId);
}

/**
 * Store and publish the user's explicit playback intent for a media item.
 *
 * @param mediaId - Stable media ID to update
 * @param paused - Whether the media should remain paused
 * @returns Nothing
 *
 * @example
 * ```ts
 * setMediaVideoPlaybackPaused("med_123", true);
 * ```
 */
export function setMediaVideoPlaybackPaused(
  mediaId: string | undefined,
  paused: boolean,
): void {
  const normalizedMediaId = mediaId?.trim();
  if (!normalizedMediaId) return;

  if (paused) {
    manuallyPausedMediaIds.add(normalizedMediaId);
  } else {
    manuallyPausedMediaIds.delete(normalizedMediaId);
  }

  document.dispatchEvent(
    new CustomEvent<MediaVideoPlaybackIntentDetail>(
      MEDIA_VIDEO_PLAYBACK_INTENT_EVENT,
      {
        detail: { mediaId: normalizedMediaId, paused },
      },
    ),
  );
}
