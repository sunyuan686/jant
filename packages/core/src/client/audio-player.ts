/**
 * Audio Player — delegated event handler for custom audio cards.
 *
 * Play/pause via [data-audio-play] buttons, seek via [data-audio-waveform]
 * canvas (primary) or [data-audio-range] range input (fallback before
 * waveform loads). The card contains a hidden `<audio preload="none">`
 * element that is only loaded on first play.
 *
 * Waveform peaks are extracted from the audio data on first play via the
 * Web Audio API and rendered on a <canvas> inside the artwork area.
 *
 * No framework — vanilla delegated events + requestAnimationFrame.
 */

let activeCard: HTMLElement | null = null;
let rafId = 0;
let isSeeking = false;
let seekingRange: HTMLInputElement | null = null;
let seekingCanvas: HTMLCanvasElement | null = null;
let seekRatio = 0;

// --- Helpers ---

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function getAudio(card: HTMLElement): HTMLAudioElement | null {
  return card.querySelector<HTMLAudioElement>("audio.media-audio-el");
}

function getRange(card: HTMLElement): HTMLInputElement | null {
  return card.querySelector<HTMLInputElement>("[data-audio-range]");
}

function getCanvas(card: HTMLElement): HTMLCanvasElement | null {
  return card.querySelector<HTMLCanvasElement>("[data-audio-waveform]");
}

/** Paint the filled portion of the range track via linear-gradient. */
function paintTrack(range: HTMLInputElement, ratio: number) {
  const pct = `${(ratio * 100).toFixed(1)}%`;
  range.style.background = `linear-gradient(to right, var(--site-text-primary) ${pct}, transparent ${pct})`;
}

// --- Waveform ---

const cardPeaks = new WeakMap<HTMLElement, number[]>();
const waveformLoading = new WeakSet<HTMLElement>();

/**
 * Extract peak amplitudes from an audio file for waveform visualization.
 *
 * @param url - Audio file URL (served with proper cache headers)
 * @param count - Number of bars to generate
 * @returns Normalized peak values (0–1)
 */
async function extractPeaks(url: string, count: number): Promise<number[]> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const audioCtx = new AudioContext();

  try {
    const decoded = await audioCtx.decodeAudioData(buffer);
    const raw = decoded.getChannelData(0);
    const step = Math.max(1, Math.floor(raw.length / count));
    const peaks: number[] = new Array(count);

    for (let i = 0; i < count; i++) {
      let max = 0;
      const start = i * step;
      const end = Math.min(start + step, raw.length);
      for (let j = start; j < end; j++) {
        const v = Math.abs(raw[j]);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }

    let maxPeak = 0;
    for (const p of peaks) if (p > maxPeak) maxPeak = p;
    if (maxPeak > 0) {
      for (let i = 0; i < count; i++) peaks[i] /= maxPeak;
    }

    return peaks;
  } finally {
    await audioCtx.close();
  }
}

/**
 * Initialize pre-computed waveforms on page load.
 * Queries all canvases with [data-audio-peaks], parses JSON peaks,
 * stores in cardPeaks WeakMap, and draws the initial waveform.
 *
 * Drawing is deferred via requestAnimationFrame so the browser has
 * time to lay out the canvas (which starts as display:none and only
 * becomes visible when the `has-waveform` class is added).
 */
export function initPrecomputedWaveforms(
  root: globalThis.Document | globalThis.Element = document,
) {
  const canvases =
    root.querySelectorAll<HTMLCanvasElement>("[data-audio-peaks]");
  const cardsToRender: HTMLElement[] = [];

  for (const canvas of canvases) {
    const peaksJson = canvas.dataset.audioPeaks;
    if (!peaksJson) continue;

    const card = canvas.closest<HTMLElement>(".media-audio-card");
    if (!card || cardPeaks.has(card)) continue;

    try {
      const peaks = JSON.parse(peaksJson) as number[];
      if (!Array.isArray(peaks)) continue;
      cardPeaks.set(card, peaks);
      card.classList.add("has-waveform");
      cardsToRender.push(card);
    } catch {
      // Invalid JSON — skip
    }
  }

  // Defer draw until after layout so the canvas has non-zero dimensions
  if (cardsToRender.length > 0) {
    requestAnimationFrame(() => {
      for (const card of cardsToRender) {
        drawWaveform(card, 0);
      }
    });
  }
}

/** Load waveform for a card (called once on first play). */
async function loadWaveform(card: HTMLElement) {
  if (cardPeaks.has(card) || waveformLoading.has(card)) return;
  waveformLoading.add(card);

  const source = card.querySelector<HTMLSourceElement>(
    "audio.media-audio-el source",
  );
  const canvas = getCanvas(card);
  if (!source?.src || !canvas) return;

  const width = canvas.getBoundingClientRect().width;
  const barCount = Math.max(20, Math.floor(width / 3));

  try {
    const peaks = await extractPeaks(source.src, barCount);
    cardPeaks.set(card, peaks);
    card.classList.add("has-waveform");

    const audio = getAudio(card);
    const dur = audio?.duration ?? 0;
    const progress =
      audio && isFinite(dur) && dur > 0 ? audio.currentTime / dur : 0;
    drawWaveform(card, progress);
  } catch {
    // Extraction failed — range slider fallback stays visible
  }
}

/** Draw the waveform bars on a card's canvas. */
function drawWaveform(card: HTMLElement, progress: number) {
  const peaks = cardPeaks.get(card);
  const canvas = getCanvas(card);
  if (!peaks || !canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);
  if (w === 0 || h === 0) return;

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);

  const count = peaks.length;
  const step = w / count;
  const barW = Math.max(1, Math.round(step * 0.6));
  const minH = Math.round(2 * dpr);
  const maxH = h * 0.85;

  const color =
    getComputedStyle(canvas).getPropertyValue("--site-text-primary").trim() ||
    "#000";

  for (let i = 0; i < count; i++) {
    const x = Math.round(i * step + (step - barW) / 2);
    const barH = Math.max(minH, Math.round(peaks[i] * maxH));
    const y = Math.round((h - barH) / 2);
    const played = (i + 0.5) / count <= progress;

    ctx.globalAlpha = played ? 0.9 : 0.2;
    ctx.fillStyle = color;
    const r = Math.min(barW / 2, dpr);
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, r);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

// --- Sync & Tick ---

function syncUI(card: HTMLElement, audio: HTMLAudioElement) {
  const { currentTime, duration } = audio;
  const ok = isFinite(duration) && duration > 0;
  const progress = ok ? currentTime / duration : 0;

  if (!isSeeking) {
    const range = getRange(card);
    if (range && ok) {
      range.value = String(Math.round(progress * 1000));
      paintTrack(range, progress);
    }

    if (cardPeaks.has(card)) {
      drawWaveform(card, progress);
    }

    const timeEl = card.querySelector<HTMLElement>("[data-audio-time]");
    if (timeEl) {
      timeEl.textContent = ok
        ? `${fmt(currentTime)} / ${fmt(duration)}`
        : fmt(currentTime);
    }
  }
}

function tick() {
  if (!activeCard) return;
  const audio = getAudio(activeCard);
  if (!audio || audio.paused) return;
  syncUI(activeCard, audio);
  rafId = requestAnimationFrame(tick);
}

// --- Player actions ---

function stopAll() {
  if (activeCard) {
    const prev = getAudio(activeCard);
    if (prev && !prev.paused) prev.pause();
    activeCard.classList.remove("is-playing");
    activeCard = null;
  }
  cancelAnimationFrame(rafId);
}

async function togglePlay(card: HTMLElement) {
  const audio = getAudio(card);
  if (!audio) return;

  if (activeCard && activeCard !== card) stopAll();

  if (audio.paused) {
    activeCard = card;
    card.classList.add("is-playing");
    try {
      await audio.play();
    } catch {
      card.classList.remove("is-playing");
      activeCard = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
    loadWaveform(card);
  } else {
    audio.pause();
    card.classList.remove("is-playing");
    cancelAnimationFrame(rafId);
    activeCard = null;
  }
}

/** Seek from range input value. */
function commitSeek(range: HTMLInputElement) {
  const card = range.closest<HTMLElement>(".media-audio-card");
  if (!card) return;
  const audio = getAudio(card);
  if (!audio) return;

  const ratio = Number(range.value) / 1000;
  const dur = audio.duration;
  if (isFinite(dur) && dur > 0) {
    audio.currentTime = ratio * dur;
  }
}

/** Update waveform + time text during canvas drag (visual preview only). */
function previewCanvasSeek(canvas: HTMLCanvasElement, e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  seekRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

  const card = canvas.closest<HTMLElement>(".media-audio-card");
  if (!card) return;
  drawWaveform(card, seekRatio);

  const audio = getAudio(card);
  const timeEl = card.querySelector<HTMLElement>("[data-audio-time]");
  if (audio && timeEl) {
    const dur = audio.duration;
    if (isFinite(dur) && dur > 0) {
      timeEl.textContent = `${fmt(seekRatio * dur)} / ${fmt(dur)}`;
    }
  }
}

/** Commit canvas seek and start playback if paused. */
async function commitCanvasSeek(canvas: HTMLCanvasElement) {
  const card = canvas.closest<HTMLElement>(".media-audio-card");
  if (!card) return;
  const audio = getAudio(card);
  if (!audio) return;

  if (audio.paused) {
    // Not playing — start playback first (loads audio if preload="none"),
    // then seek once duration is available.
    if (activeCard && activeCard !== card) stopAll();
    activeCard = card;
    card.classList.add("is-playing");
    try {
      await audio.play();
    } catch {
      card.classList.remove("is-playing");
      activeCard = null;
      return;
    }
    const dur = audio.duration;
    if (isFinite(dur) && dur > 0) {
      audio.currentTime = seekRatio * dur;
    }
    rafId = requestAnimationFrame(tick);
    loadWaveform(card);
  } else {
    // Already playing — just seek
    const dur = audio.duration;
    if (isFinite(dur) && dur > 0) {
      audio.currentTime = seekRatio * dur;
    }
  }
}

// --- Delegated event listeners ---

// Pointer tracking for both range input and waveform canvas
document.addEventListener(
  "pointerdown",
  (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.matches("[data-audio-range]")) {
      isSeeking = true;
      seekingRange = target as HTMLInputElement;
    } else if (target.matches("[data-audio-waveform]")) {
      isSeeking = true;
      seekingCanvas = target as HTMLCanvasElement;
      previewCanvasSeek(target as HTMLCanvasElement, e as PointerEvent);
    }
  },
  true,
);

document.addEventListener(
  "pointermove",
  (e: Event) => {
    if (isSeeking && seekingCanvas) {
      previewCanvasSeek(seekingCanvas, e as PointerEvent);
    }
  },
  true,
);

document.addEventListener(
  "pointerup",
  () => {
    if (isSeeking) {
      if (seekingRange) {
        commitSeek(seekingRange);
        seekingRange = null;
      } else if (seekingCanvas) {
        commitCanvasSeek(seekingCanvas);
        seekingCanvas = null;
      }
    }
    isSeeking = false;
  },
  true,
);

document.addEventListener(
  "pointercancel",
  () => {
    seekingRange = null;
    seekingCanvas = null;
    isSeeking = false;
  },
  true,
);

// Play / Pause
document.addEventListener("click", (e: Event) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-audio-play]",
  );
  if (!btn) return;
  e.preventDefault();
  const card = btn.closest<HTMLElement>(".media-audio-card");
  if (card) togglePlay(card);
});

// Range input fallback — visual preview only, seek on pointerup
document.addEventListener(
  "input",
  (e: Event) => {
    const range = e.target as HTMLInputElement;
    if (!range.matches("[data-audio-range]")) return;

    const card = range.closest<HTMLElement>(".media-audio-card");
    if (!card) return;

    const audio = getAudio(card);
    if (!audio) return;

    const ratio = Number(range.value) / 1000;
    paintTrack(range, ratio);

    const dur = audio.duration;
    const timeEl = card.querySelector<HTMLElement>("[data-audio-time]");
    if (timeEl && isFinite(dur) && dur > 0) {
      timeEl.textContent = `${fmt(ratio * dur)} / ${fmt(dur)}`;
    }
  },
  true,
);

// Audio "ended" doesn't bubble — use capture
document.addEventListener(
  "ended",
  (e: Event) => {
    const el = e.target as HTMLElement;
    if (!el.closest) return;
    const card = el.closest<HTMLElement>(".media-audio-card");
    if (!card) return;

    card.classList.remove("is-playing");
    cancelAnimationFrame(rafId);
    activeCard = null;

    const range = getRange(card);
    if (range) {
      range.value = "0";
      paintTrack(range, 0);
    }
    if (cardPeaks.has(card)) {
      drawWaveform(card, 0);
    }
    const timeEl = card.querySelector<HTMLElement>("[data-audio-time]");
    if (timeEl) timeEl.textContent = "0:00";
  },
  true,
);

// --- Initialize pre-computed waveforms on page load ---

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () =>
    initPrecomputedWaveforms(),
  );
} else {
  initPrecomputedWaveforms();
}
