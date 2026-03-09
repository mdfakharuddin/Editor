/**
 * videoStore — Video clip & timeline state management
 *
 * ─── Rendering Architecture ──────────────────────────────────────────────────
 *
 *  HTML5 Video + Canvas drawImage  (chosen approach)
 *  ─────────────────────────────────────────────────
 *  Each clip owns a hidden HTMLVideoElement (never appended to the DOM).
 *  Fabric.js `fabric.Image` accepts an HTMLVideoElement directly as its
 *  `_element`. When Fabric renders that object it calls:
 *    ctx.drawImage(videoEl, -w/2, -h/2, w, h)
 *  which snapshots the video's current frame. By calling
 *    canvas.requestRenderAll()
 *  on every rAF tick we get per-frame video composited with all other
 *  canvas objects (text, shapes, images) with zero extra complexity.
 *
 *  WebGL / WebCodecs — when to use them instead:
 *  • WebGL: needed for GPU color-grading, chroma-key, pixel shaders.
 *    Requires a OffscreenCanvas bridge and more plumbing.
 *  • WebCodecs: needed for frame-exact export / server-side processing.
 *    The VideoDecoder API gives raw VideoFrame objects perfect for FFmpeg
 *    pipeline integration, but has ~70% browser support (2025).
 *  For a design editor (Canva/Figma style) the Canvas approach is optimal.
 *
 * ─── Timeline Sync ───────────────────────────────────────────────────────────
 *  A single `playhead` (seconds) acts as the global clock.
 *  The render loop (useVideoRenderer hook) advances it with performance.now()
 *  deltas, then for every active clip computes:
 *    videoEl.currentTime = playhead - clip.startTime + clip.trimStart
 *  If the seek delta is < SEEK_THRESHOLD we skip the seek to avoid jank.
 *  We do NOT call videoEl.play() — manual currentTime control gives us
 *  frame-accurate scrubbing, multi-clip sync, and trim support for free.
 *
 * ─── Performance Considerations ─────────────────────────────────────────────
 *  • canvas.renderOnAddRemove = false during bulk operations.
 *  • requestRenderAll() (async, batched) vs renderAll() (sync) — always prefer
 *    the former inside the rAF loop.
 *  • Video elements are kept in a module-level Map (not Zustand state) to
 *    avoid serialisation overhead and React re-render pressure.
 *  • Off-screen clips (playhead outside startTime..endTime range) get their
 *    video element paused/seeked to trimStart to conserve GPU decode budget.
 *  • Thumbnail generation: one-time canvas snapshot at load time (seeked to
 *    0.5s), stored as data-URL in the clip record.
 *
 * ─── Object Grouping ─────────────────────────────────────────────────────────
 *  Each VideoClip maps 1:1 to one fabric.Image on the canvas via
 *  `clip.fabricObjectId` (= `obj.__id`). The fabric object is not grouped
 *  with anything by default; users can group it with shapes/text normally.
 *
 * ─── Trim Model ──────────────────────────────────────────────────────────────
 *  clip.duration    = total file duration (immutable)
 *  clip.trimStart   = seconds cut from the beginning  [0, duration)
 *  clip.trimEnd     = playback ends at this file-time  (trimStart, duration]
 *  clip.startTime   = where this clip begins on the timeline
 *  effective length = trimEnd - trimStart
 *  When playhead = T, active clip seeks to: T - startTime + trimStart
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useEditorStore, generateId, syncLayersFromCanvas } from './editorStore';

// ─── Non-serialisable DOM elements (module-level, outside Zustand) ────────────

/** Map<clipId, HTMLVideoElement> — kept outside store to avoid serialisation */
export const videoElementsMap = new Map<string, HTMLVideoElement>();
/** Map<clipId, fabric.Image reference> */
export const fabricVideoMap = new Map<string, any>();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoClip {
  id: string;
  name: string;
  src: string;         // blob URL
  duration: number;    // total file duration (s)
  startTime: number;   // timeline position (s)
  trimStart: number;   // cut from beginning (s)
  trimEnd: number;     // effective end in clip-time (s)
  width: number;       // original video width (px)
  height: number;      // original video height (px)
  fabricObjectId: string | null;
  thumbnail: string | null;  // data-URL of first frame
  trackIndex: number;  // which row in the timeline
  volume: number;      // 0–1
  muted: boolean;
}

interface VideoState {
  clips: VideoClip[];
  playhead: number;       // seconds
  isPlaying: boolean;
  totalDuration: number;  // derived: max(startTime + trimEnd - trimStart)
  timelineZoom: number;   // pixels per second

  // ── Queries ────────────────────────────────────────────────────────────────
  getClipAt: (t: number) => VideoClip[];
  getDuration: () => number;

  // ── Playback ───────────────────────────────────────────────────────────────
  play: () => void;
  pause: () => void;
  stop: () => void;
  setPlayhead: (t: number) => void;
  setTimelineZoom: (zoom: number) => void;

  // ── Clip management ────────────────────────────────────────────────────────
  addClip: (clip: VideoClip) => void;
  removeClip: (id: string) => void;
  updateClip: (id: string, updates: Partial<VideoClip>) => void;

  // ── Trim ───────────────────────────────────────────────────────────────────
  setTrim: (id: string, trimStart: number, trimEnd: number) => void;

  // ── Move on timeline ───────────────────────────────────────────────────────
  moveClip: (id: string, startTime: number) => void;
}

function computeDuration(clips: VideoClip[]): number {
  if (!clips.length) return 30; // default 30s empty timeline
  return Math.max(...clips.map((c) => c.startTime + (c.trimEnd - c.trimStart)), 30);
}

export const useVideoStore = create<VideoState>()(
  subscribeWithSelector((set, get) => ({
    clips: [],
    playhead: 0,
    isPlaying: false,
    totalDuration: 30,
    timelineZoom: 80, // 80px per second

    getClipAt: (t) => {
      return get().clips.filter((c) => {
        const end = c.startTime + (c.trimEnd - c.trimStart);
        return t >= c.startTime && t < end;
      });
    },

    getDuration: () => get().totalDuration,

    play: () => set({ isPlaying: true }),
    pause: () => set({ isPlaying: false }),
    stop: () => set({ isPlaying: false, playhead: 0 }),

    setPlayhead: (t) => {
      const { totalDuration } = get();
      const clamped = Math.max(0, Math.min(t, totalDuration));
      set({ playhead: clamped });
    },

    setTimelineZoom: (timelineZoom) => set({ timelineZoom }),

    addClip: (clip) => {
      set((s) => {
        const clips = [...s.clips, clip];
        return { clips, totalDuration: computeDuration(clips) };
      });
    },

    removeClip: (id) => {
      const clip = get().clips.find((c) => c.id === id);
      if (!clip) return;

      // Clean up video element
      const el = videoElementsMap.get(id);
      if (el) { el.src = ''; videoElementsMap.delete(id); }

      // Revoke blob URL
      if (clip.src.startsWith('blob:')) URL.revokeObjectURL(clip.src);

      // Remove fabric object
      const canvas = useEditorStore.getState().canvas;
      const fabObj = fabricVideoMap.get(id);
      if (canvas && fabObj) {
        canvas.remove(fabObj);
        canvas.requestRenderAll();
        useEditorStore.getState().setLayers(syncLayersFromCanvas(canvas));
      }
      fabricVideoMap.delete(id);

      set((s) => {
        const clips = s.clips.filter((c) => c.id !== id);
        return { clips, totalDuration: computeDuration(clips) };
      });
    },

    updateClip: (id, updates) => {
      set((s) => {
        const clips = s.clips.map((c) => (c.id === id ? { ...c, ...updates } : c));
        return { clips, totalDuration: computeDuration(clips) };
      });
    },

    setTrim: (id, trimStart, trimEnd) => {
      const clip = get().clips.find((c) => c.id === id);
      if (!clip) return;
      const ts = Math.max(0, Math.min(trimStart, clip.duration - 0.5));
      const te = Math.max(ts + 0.5, Math.min(trimEnd, clip.duration));
      set((s) => {
        const clips = s.clips.map((c) => (c.id === id ? { ...c, trimStart: ts, trimEnd: te } : c));
        return { clips, totalDuration: computeDuration(clips) };
      });
    },

    moveClip: (id, startTime) => {
      const st = Math.max(0, startTime);
      set((s) => {
        const clips = s.clips.map((c) => (c.id === id ? { ...c, startTime: st } : c));
        return { clips, totalDuration: computeDuration(clips) };
      });
    },
  }))
);

// ─── Async helper: load video file → add to canvas + store ───────────────────

const SEEK_THRESHOLD = 0.05; // ~1.5 frames at 30fps

/**
 * addVideoFile
 * ─────────────
 * 1. Creates a blob URL + hidden HTMLVideoElement
 * 2. Waits for loadedmetadata to get duration & dimensions
 * 3. Captures a thumbnail at 0.5s (or first available frame)
 * 4. Seeks back to frame 0 and awaits the seeked event
 * 5. Calls video.play() → pause() to force the browser to decode frame 0
 *    (many browsers won't decode any frame until play() is invoked once)
 * 6. Creates a fabric.Image with the video element as source
 * 7. Registers everything in videoElementsMap / fabricVideoMap / videoStore
 *
 * Key implementation notes:
 * • NO crossOrigin on blob URLs — blob URLs are same-origin; setting
 *   crossOrigin causes browsers to apply CORS checks, which blob URLs fail
 *   (they return no CORS headers), making drawImage() throw a security error
 *   and rendering nothing on canvas.
 * • preload="auto" — metadata-only preload means frame data isn't buffered,
 *   causing blank frames on first seek.
 * • objectCaching: false — required so Fabric calls drawImage() on every
 *   render pass instead of using a cached bitmap.
 */
export async function addVideoFile(file: File): Promise<void> {
  const { canvas } = useEditorStore.getState();
  if (!canvas) throw new Error('Canvas not initialised');

  const fabric = (window as any).fabric;
  if (!fabric) throw new Error('Fabric.js not loaded');

  const src = URL.createObjectURL(file);
  const id = generateId();

  // ── 1. Create video element ───────────────────────────────────────────────
  // IMPORTANT: do NOT set crossOrigin on blob URLs — it causes CORS security
  // errors that silently prevent drawImage() from rendering any pixels.
  const videoEl = document.createElement('video');
  videoEl.src = src;
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.preload = 'auto'; // 'metadata' only loads headers, not frame data
  videoEl.loop = false;
  videoElementsMap.set(id, videoEl);

  // ── 2. Wait for enough data to get dimensions + first frame ──────────────
  await new Promise<void>((resolve, reject) => {
    const onReady = () => resolve();
    const onErr = () => reject(new Error(`Video failed to load: ${file.name}`));
    videoEl.addEventListener('loadeddata', onReady, { once: true });
    videoEl.addEventListener('error', onErr, { once: true });
    // loadedmetadata is a fallback if loadeddata doesn't fire quickly
    videoEl.addEventListener('loadedmetadata', () => {
      // give it a short window to also fire loadeddata
      setTimeout(resolve, 80);
    }, { once: true });
    videoEl.load();
  });

  const duration = videoEl.duration || 0;
  const vw = videoEl.videoWidth || 640;
  const vh = videoEl.videoHeight || 360;

  // ── 3. Capture thumbnail ──────────────────────────────────────────────────
  let thumbnail: string | null = null;
  try {
    await seekTo(videoEl, Math.min(0.5, duration * 0.05));
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 160;
    thumbCanvas.height = Math.round(160 * (vh / vw));
    const tctx = thumbCanvas.getContext('2d')!;
    tctx.drawImage(videoEl, 0, 0, thumbCanvas.width, thumbCanvas.height);
    thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.5);
  } catch { /* thumbnail is optional */ }

  // ── 4. Seek to frame 0 and await completion ───────────────────────────────
  // This ensures the browser has decoded a valid frame before we hand the
  // element to fabric.Image. Without this, drawImage() finds no decoded data.
  await seekTo(videoEl, 0);

  // ── 5. Force frame decode via play→pause ─────────────────────────────────
  // Many browsers won't decode any pixels until play() is called at least
  // once. We call play() and immediately pause to decode exactly one frame.
  try {
    const playPromise = videoEl.play();
    if (playPromise) await playPromise;
    videoEl.pause();
    videoEl.currentTime = 0;
  } catch {
    // Autoplay might be blocked by browser policy — that's OK.
    // The seeked frame from step 4 should still be available.
  }

  // ── 6. Determine canvas placement ─────────────────────────────────────────
  const { artboardWidth, artboardHeight } = useEditorStore.getState();
  const scale = Math.min((artboardWidth * 0.7) / vw, (artboardHeight * 0.7) / vh, 1);

  // ── 7. Create fabric.Image with video element ─────────────────────────────
  // fabric.Image stores the videoEl as _element and calls ctx.drawImage() in
  // _render(). objectCaching: false is REQUIRED — with caching enabled, Fabric
  // captures a static bitmap on first render and never updates it.
  const fabImg = new fabric.Image(videoEl, {
    left: artboardWidth / 2,
    top: artboardHeight / 2,
    originX: 'center',
    originY: 'center',
    width: vw,
    height: vh,
    scaleX: scale,
    scaleY: scale,
    objectCaching: false,
  });
  (fabImg as any).__id = id;
  (fabImg as any).__name = file.name.replace(/\.[^.]+$/, '');
  (fabImg as any).__isVideo = true;
  (fabImg as any).__videoClipId = id;

  canvas.add(fabImg);
  canvas.setActiveObject(fabImg);

  // Force an immediate synchronous render so the first frame is visible right away
  canvas.renderAll();

  // Also schedule async renders to handle any decode lag
  setTimeout(() => canvas.renderAll(), 50);
  setTimeout(() => canvas.renderAll(), 150);

  fabricVideoMap.set(id, fabImg);
  useEditorStore.getState().setLayers(syncLayersFromCanvas(canvas));

  // ── 8. Determine track index ──────────────────────────────────────────────
  const existingTracks = new Set(useVideoStore.getState().clips.map((c) => c.trackIndex));
  let trackIndex = 0;
  while (existingTracks.has(trackIndex)) trackIndex++;

  // ── 9. Register clip ──────────────────────────────────────────────────────
  const clip: VideoClip = {
    id,
    name: (fabImg as any).__name,
    src,
    duration,
    startTime: 0,
    trimStart: 0,
    trimEnd: duration,
    width: vw,
    height: vh,
    fabricObjectId: id,
    thumbnail,
    trackIndex,
    volume: 1,
    muted: true,
  };

  useVideoStore.getState().addClip(clip);

  setTimeout(() => {
    const json = JSON.stringify(canvas.toJSON(['__id', '__name', '__isArtboard', '__isVideo', '__videoClipId']));
    useEditorStore.getState().pushHistory(json);
  }, 40);
}

/**
 * seekTo — seek a video element to a time and await the seeked event.
 * Returns early if already at the target time (within threshold).
 */
export function seekTo(el: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(el.currentTime - time) < 0.01) {
      resolve();
      return;
    }
    const onSeeked = () => resolve();
    el.addEventListener('seeked', onSeeked, { once: true });
    el.currentTime = time;
    // Safety timeout in case seeked never fires (some codecs / browsers)
    setTimeout(resolve, 500);
  });
}

/**
 * seekAllVideos — position all video elements to match the given playhead.
 * Only seeks when the delta exceeds SEEK_THRESHOLD to avoid excessive
 * decode-seek cycles that cause stuttering.
 */
export function seekAllVideos(playhead: number): void {
  const { clips } = useVideoStore.getState();
  clips.forEach((clip) => {
    const el = videoElementsMap.get(clip.id);
    if (!el) return;
    const clipEnd = clip.startTime + (clip.trimEnd - clip.trimStart);
    if (playhead >= clip.startTime && playhead < clipEnd) {
      const target = playhead - clip.startTime + clip.trimStart;
      if (Math.abs(el.currentTime - target) > SEEK_THRESHOLD) {
        el.currentTime = target;
      }
    } else {
      // Park at trim start when clip is not in range
      if (Math.abs(el.currentTime - clip.trimStart) > SEEK_THRESHOLD) {
        el.currentTime = clip.trimStart;
      }
    }
  });
}

/** Set of clip IDs that are currently calling video.play() */
const playingVideoIds = new Set<string>();

/**
 * syncVideoPlayback — called by the renderer on each tick.
 *
 * When playing:
 *   - Clips in range: call video.play() (browser handles frame timing natively)
 *   - Clips out of range: call video.pause(), seek to trimStart
 *
 * Using video.play() instead of manual currentTime control is the key insight:
 * the browser's media pipeline handles frame decode timing perfectly at native
 * speed. We just call canvas.requestRenderAll() on each RAF tick to composite
 * the current decoded frame. This avoids the "render before seek completes"
 * race condition of the manual approach.
 *
 * Drift correction: on each tick we check if the video's currentTime has
 * drifted more than 2 frames from the expected position (due to different
 * decode speeds) and re-sync if needed.
 */
export function syncVideoPlayback(playhead: number, isPlaying: boolean): void {
  const { clips } = useVideoStore.getState();

  clips.forEach((clip) => {
    const el = videoElementsMap.get(clip.id);
    if (!el) return;

    const clipEnd = clip.startTime + (clip.trimEnd - clip.trimStart);
    const inRange = playhead >= clip.startTime && playhead < clipEnd;

    if (isPlaying && inRange) {
      const expectedTime = playhead - clip.startTime + clip.trimStart;
      const drift = Math.abs(el.currentTime - expectedTime);

      if (!playingVideoIds.has(clip.id)) {
        // First time entering range — seek to correct position then play
        el.currentTime = expectedTime;
        el.muted = clip.muted;
        el.volume = clip.volume;
        el.play().then(() => {
          playingVideoIds.add(clip.id);
        }).catch(() => {
          // Autoplay blocked — fall back to manual currentTime
          playingVideoIds.add(clip.id);
        });
      } else if (drift > 0.1) {
        // Drifted more than ~3 frames — re-sync
        el.currentTime = expectedTime;
      }
    } else {
      // Out of range or paused — pause and park
      if (playingVideoIds.has(clip.id)) {
        el.pause();
        playingVideoIds.delete(clip.id);
      }
      if (!isPlaying) {
        // Scrubbing: park at exact position (sync happens via playhead subscription)
      } else {
        // Clip not active during playback: park at trimStart
        if (Math.abs(el.currentTime - clip.trimStart) > SEEK_THRESHOLD) {
          el.currentTime = clip.trimStart;
        }
      }
    }
  });
}

/** Stop all playing videos (called on pause/stop) */
export function pauseAllVideos(): void {
  playingVideoIds.forEach((id) => {
    const el = videoElementsMap.get(id);
    if (el) el.pause();
  });
  playingVideoIds.clear();
}