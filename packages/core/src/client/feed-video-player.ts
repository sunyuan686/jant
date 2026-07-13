import { MEDIA_LIGHTBOX_TOGGLE_EVENT } from "./media-lightbox-events.js";

const FEED_VIDEO_PRELOAD_ROOT_MARGIN = "75% 0px";
const FEED_VIDEO_PLAY_THRESHOLD = 0.6;
const FEED_VIDEO_PAUSE_THRESHOLD = 0.25;
const FEED_VIDEO_REEVALUATE_DEBOUNCE_MS = 160;

interface FeedVideoMetrics {
  intersectionRatio: number;
  visibleArea: number;
  centerDistance: number;
}

export interface FeedVideoCandidate<T> {
  video: T;
  intersectionRatio: number;
  visibleArea: number;
  centerDistance: number;
}

const registeredVideos = new Set<HTMLVideoElement>();
const videoMetrics = new WeakMap<HTMLVideoElement, FeedVideoMetrics>();
const loadedVideos = new WeakSet<HTMLVideoElement>();

let activeVideo: HTMLVideoElement | null = null;
let preferredVideo: HTMLVideoElement | null = null;
let soundEnabledVideo: HTMLVideoElement | null = null;
let lightboxOpen = false;
let reevaluateTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

let playbackObserver: globalThis.IntersectionObserver | null = null;
let preloadObserver: globalThis.IntersectionObserver | null = null;

/**
 * Pick the single feed video that should autoplay from the current candidates.
 *
 * @param candidates - Visible autoplay-eligible video candidates
 * @returns The best candidate, or `null` when none qualify
 */
export function chooseAutoplayVideo<T>(
  candidates: FeedVideoCandidate<T>[],
): FeedVideoCandidate<T> | null {
  if (candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort((a, b) => {
    if (b.visibleArea !== a.visibleArea) {
      return b.visibleArea - a.visibleArea;
    }

    if (a.centerDistance !== b.centerDistance) {
      return a.centerDistance - b.centerDistance;
    }

    return b.intersectionRatio - a.intersectionRatio;
  });

  return sorted[0] ?? null;
}

function getViewportCenter(): { x: number; y: number } {
  return {
    x: (globalThis.innerWidth || document.documentElement.clientWidth || 0) / 2,
    y:
      (globalThis.innerHeight || document.documentElement.clientHeight || 0) /
      2,
  };
}

function readMetrics(video: HTMLVideoElement): FeedVideoMetrics | undefined {
  return videoMetrics.get(video);
}

function getMuteButton(video: HTMLVideoElement): HTMLButtonElement | null {
  return (
    video
      .closest<HTMLElement>(".media-video-wrap")
      ?.querySelector<HTMLButtonElement>("[data-feed-video-mute-toggle]") ??
    null
  );
}

function syncMuteButton(video: HTMLVideoElement): void {
  const button = getMuteButton(video);
  if (!button) {
    return;
  }

  const isMuted = soundEnabledVideo !== video || video.muted;
  button.dataset.muted = isMuted ? "true" : "false";
  button.setAttribute("aria-label", isMuted ? "Play with sound" : "Mute video");
}

function syncMuteButtons(): void {
  for (const video of registeredVideos) {
    syncMuteButton(video);
  }
}

function ensureVideoLoaded(video: HTMLVideoElement): void {
  if (loadedVideos.has(video)) {
    return;
  }

  const src = video.dataset.videoSrc;
  if (!src) {
    return;
  }

  if (video.getAttribute("src") !== src) {
    video.src = src;
  }
  video.load();
  loadedVideos.add(video);
}

function pauseVideo(video: HTMLVideoElement | null): void {
  video?.pause();
}

function playVideo(video: HTMLVideoElement): void {
  ensureVideoLoaded(video);
  video.muted = soundEnabledVideo !== video;
  video.playsInline = true;
  video.loop = true;
  syncMuteButton(video);
  void video.play().catch(() => {});
}

function cleanupDisconnectedVideos(): void {
  for (const video of registeredVideos) {
    if (video.isConnected) continue;
    playbackObserver?.unobserve(video);
    preloadObserver?.unobserve(video);
    registeredVideos.delete(video);
    if (video === activeVideo) {
      activeVideo = null;
    }
    if (video === preferredVideo) {
      preferredVideo = null;
    }
    if (video === soundEnabledVideo) {
      soundEnabledVideo = null;
    }
  }
}

function reevaluateAutoplay(): void {
  reevaluateTimer = null;
  cleanupDisconnectedVideos();

  if (document.hidden || lightboxOpen) {
    pauseVideo(activeVideo);
    return;
  }

  const candidates: FeedVideoCandidate<HTMLVideoElement>[] = [];
  for (const video of registeredVideos) {
    const metrics = readMetrics(video);
    if (!metrics) continue;
    if (metrics.intersectionRatio < FEED_VIDEO_PLAY_THRESHOLD) continue;
    candidates.push({ video, ...metrics });
  }

  let winner: HTMLVideoElement | null = null;
  if (preferredVideo?.isConnected) {
    const preferredMetrics = readMetrics(preferredVideo);
    if (
      preferredMetrics &&
      preferredMetrics.intersectionRatio > FEED_VIDEO_PAUSE_THRESHOLD
    ) {
      winner = preferredVideo;
    } else if (
      !preferredMetrics ||
      preferredMetrics.intersectionRatio <= FEED_VIDEO_PAUSE_THRESHOLD
    ) {
      preferredVideo = null;
    }
  }

  if (!winner) {
    winner = chooseAutoplayVideo(candidates)?.video ?? null;
  }

  if (!winner) {
    const currentMetrics = activeVideo ? readMetrics(activeVideo) : undefined;
    if (
      activeVideo &&
      currentMetrics &&
      currentMetrics.intersectionRatio > FEED_VIDEO_PAUSE_THRESHOLD
    ) {
      return;
    }
    pauseVideo(activeVideo);
    activeVideo = null;
    return;
  }

  if (winner !== activeVideo) {
    pauseVideo(activeVideo);
    activeVideo = winner;
  }

  playVideo(winner);

  for (const video of registeredVideos) {
    if (video !== winner) {
      pauseVideo(video);
      syncMuteButton(video);
    }
  }
}

function scheduleReevaluate(): void {
  if (reevaluateTimer !== null) {
    globalThis.clearTimeout(reevaluateTimer);
  }

  reevaluateTimer = globalThis.setTimeout(
    reevaluateAutoplay,
    FEED_VIDEO_REEVALUATE_DEBOUNCE_MS,
  );
}

function handlePlaybackIntersection(
  entries: globalThis.IntersectionObserverEntry[],
): void {
  const viewportCenter = getViewportCenter();

  for (const entry of entries) {
    const video = entry.target as HTMLVideoElement;
    const rect = entry.boundingClientRect;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const visibleArea =
      entry.intersectionRect.width * entry.intersectionRect.height;
    const centerDistance = Math.hypot(
      centerX - viewportCenter.x,
      centerY - viewportCenter.y,
    );

    videoMetrics.set(video, {
      intersectionRatio: entry.intersectionRatio,
      visibleArea,
      centerDistance,
    });
  }

  scheduleReevaluate();
}

function handlePreloadIntersection(
  entries: globalThis.IntersectionObserverEntry[],
): void {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    ensureVideoLoaded(entry.target as HTMLVideoElement);
  }
}

function ensureObservers(): void {
  if (playbackObserver && preloadObserver) {
    return;
  }

  if (typeof globalThis.IntersectionObserver === "undefined") {
    return;
  }

  playbackObserver = new globalThis.IntersectionObserver(
    handlePlaybackIntersection,
    {
      threshold: [0, FEED_VIDEO_PAUSE_THRESHOLD, FEED_VIDEO_PLAY_THRESHOLD, 1],
    },
  );

  preloadObserver = new globalThis.IntersectionObserver(
    handlePreloadIntersection,
    {
      rootMargin: FEED_VIDEO_PRELOAD_ROOT_MARGIN,
      threshold: 0,
    },
  );
}

function registerVideo(video: HTMLVideoElement): void {
  if (registeredVideos.has(video)) {
    return;
  }

  ensureObservers();
  if (!playbackObserver || !preloadObserver) {
    return;
  }

  registeredVideos.add(video);
  playbackObserver.observe(video);
  preloadObserver.observe(video);
  getMuteButton(video)?.addEventListener("click", handleMuteToggle);
  syncMuteButton(video);
}

function handleMuteToggle(event: Event): void {
  event.preventDefault();
  event.stopPropagation();

  const button = event.currentTarget as HTMLButtonElement;
  const video = button
    .closest<HTMLElement>(".media-video-wrap")
    ?.querySelector<HTMLVideoElement>("[data-feed-short-video]");
  if (!video) {
    return;
  }

  preferredVideo = video;

  const willEnableSound = soundEnabledVideo !== video || video.muted;
  if (willEnableSound) {
    if (soundEnabledVideo && soundEnabledVideo !== video) {
      soundEnabledVideo.muted = true;
    }
    soundEnabledVideo = video;
    if (activeVideo !== video) {
      pauseVideo(activeVideo);
      activeVideo = video;
    }
    playVideo(video);
  } else {
    soundEnabledVideo = null;
    video.muted = true;
    syncMuteButton(video);
  }

  syncMuteButtons();
  scheduleReevaluate();
}

export function initFeedVideoPlayer(
  root: globalThis.Document | globalThis.Element = document,
): void {
  const videos = root.querySelectorAll<HTMLVideoElement>(
    "[data-feed-short-video]",
  );
  for (const video of videos) {
    registerVideo(video);
  }

  scheduleReevaluate();
}

document.addEventListener(MEDIA_LIGHTBOX_TOGGLE_EVENT, (event: Event) => {
  const detail = (event as CustomEvent<{ open?: boolean }>).detail;
  lightboxOpen = detail?.open === true;
  if (lightboxOpen) {
    pauseVideo(activeVideo);
  }
  scheduleReevaluate();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseVideo(activeVideo);
  }
  scheduleReevaluate();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initFeedVideoPlayer(), {
    once: true,
  });
} else {
  queueMicrotask(() => initFeedVideoPlayer());
}
