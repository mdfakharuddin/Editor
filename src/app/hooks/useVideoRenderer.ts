/**
 * useVideoRenderer — RAF render loop for video playback + keyframe/transition engine.
 *
 * Playing:   video.play() → browser handles frame timing → canvas.requestRenderAll()
 * Scrubbing: seekTo() awaited → applyKeyframesAtTime() → canvas.renderAll()
 * Always:    applyKeyframesAtTime() + getTransitionOpacity() applied per tick.
 */

import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import {
  useVideoStore,
  syncVideoPlayback,
  pauseAllVideos,
  seekTo,
  videoElementsMap,
  fabricVideoMap,
} from '../store/videoStore';
import { applyKeyframesAtTime, getTransitionOpacity } from '../store/keyframesStore';

/** Apply clip transition opacity to fabric video objects at the given playhead */
function applyTransitionOpacity(playhead: number) {
  const { clips } = useVideoStore.getState();
  clips.forEach((clip) => {
    const fabObj = fabricVideoMap.get(clip.id);
    if (!fabObj) return;
    const clipEnd = clip.startTime + (clip.trimEnd - clip.trimStart);
    const opacity = getTransitionOpacity(clip.id, clip.startTime, clipEnd, playhead);
    fabObj.set('opacity', opacity);
  });
}

export function useVideoRenderer() {
  // ── All hooks at top, unconditional, fixed order ───────────────────────────
  const rafRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const isPlaying = useVideoStore((s) => s.isPlaying);

  // Sync ref from hook value (safe — just writing a ref, no side-effects)
  isPlayingRef.current = isPlaying;

  // ── RAF loop: plays video + advances playhead ──────────────────────────────
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pauseAllVideos();
      return;
    }

    let lastTime: number | null = null;

    const tick = (timestamp: number) => {
      if (!isPlayingRef.current) return;

      const delta = lastTime != null ? (timestamp - lastTime) / 1000 : 0;
      lastTime = timestamp;

      const store = useVideoStore.getState();
      const newPlayhead = store.playhead + delta;

      if (newPlayhead >= store.totalDuration) {
        store.pause();
        store.setPlayhead(0);
        pauseAllVideos();
        const canvas = useEditorStore.getState().canvas;
        if (canvas) canvas.requestRenderAll();
        return;
      }

      store.setPlayhead(newPlayhead);

      // Native video.play() drives frame timing — just sync play/pause state
      syncVideoPlayback(newPlayhead, true);

      const canvas = useEditorStore.getState().canvas;
      if (canvas) {
        // Apply keyframe animations to all canvas objects
        applyKeyframesAtTime(canvas, newPlayhead);
        // Apply in/out transition opacity to video fabric objects
        applyTransitionOpacity(newPlayhead);
        canvas.requestRenderAll();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying]);

  // ── Scrub handler: awaits seeks then applies keyframes/transitions ─────────
  useEffect(() => {
    const unsub = useVideoStore.subscribe(
      (s) => s.playhead,
      async (playhead) => {
        if (isPlayingRef.current) return;

        const { clips } = useVideoStore.getState();
        const canvas = useEditorStore.getState().canvas;
        if (!canvas) return;

        // Seek all video elements to correct frame in parallel
        if (clips.length > 0) {
          await Promise.all(
            clips.map((clip) => {
              const el = videoElementsMap.get(clip.id);
              if (!el) return Promise.resolve();
              const clipEnd = clip.startTime + (clip.trimEnd - clip.trimStart);
              const inRange = playhead >= clip.startTime && playhead < clipEnd;
              const target = inRange
                ? playhead - clip.startTime + clip.trimStart
                : clip.trimStart;
              return seekTo(el, target);
            })
          );
        }

        if (!isPlayingRef.current) {
          // Apply keyframes + transitions then repaint
          applyKeyframesAtTime(canvas, playhead);
          applyTransitionOpacity(playhead);
          canvas.renderAll();
        }
      }
    );
    return unsub;
  }, []);
}
