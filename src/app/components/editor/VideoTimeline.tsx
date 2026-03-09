/**
 * VideoTimeline — NLE-style timeline editor embedded below the canvas.
 *
 * Layout
 * ──────
 *  [Transport bar]  ▶ ⏸ ⏮ ⏭  |  00:00.00 / 00:30.00  |  zoom −/+
 *  [Labels column]  [Scrollable timeline area]
 *    Track 1 label    [──clip──────][──clip──]
 *    KF row           ◆           ◆
 *    + Add Track          [ruler ticks]
 *                         [playhead ──────────]
 *
 * Interactions
 * ────────────
 * • Click ruler → seek playhead
 * • Drag playhead → seek
 * • Drag clip body → move (startTime)
 * • Drag clip left/right handle → trim start / trim end
 * • Click clip in/out triangles → transition picker popover
 * • Scroll wheel → horizontal scroll; Ctrl+scroll → zoom
 * • Space key → play/pause
 * • Click clip → select its fabric object on canvas
 */

import React, {
  useRef, useState, useCallback, useEffect,
} from 'react';
import {
  Play, Pause, SkipBack, SkipForward, StopCircle,
  ZoomIn, ZoomOut, Film, Trash2, Diamond,
} from 'lucide-react';
import { useVideoStore, fabricVideoMap } from '../../store/videoStore';
import type { VideoClip } from '../../store/videoStore';
import { useEditorStore } from '../../store/editorStore';
import {
  useKeyframesStore,
  TRANSITION_DEFS,
  type TransitionType,
} from '../../store/keyframesStore';

// ─── Constants ────────────────────────────────────────────────────────────────
const RULER_H = 24;
const TRACK_H = 44;
const KF_ROW_H = 18; // keyframe diamonds sub-row height
const LABEL_W = 110;
const CLIP_COLORS = ['#1d4ed8', '#0f766e', '#7c3aed', '#b45309', '#be185d', '#1e40af'];

// ─── Time formatting ──────────────────────────────────────────────────────────
function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const f = Math.floor((secs % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${f.toString().padStart(2, '0')}`;
}

// ─── Ruler tick config ────────────────────────────────────────────────────────
function tickConfig(pxPerSec: number): { major: number; minor: number } {
  if (pxPerSec >= 300) return { major: 1, minor: 0.5 };
  if (pxPerSec >= 120) return { major: 2, minor: 1 };
  if (pxPerSec >= 60)  return { major: 5, minor: 1 };
  if (pxPerSec >= 25)  return { major: 10, minor: 5 };
  return { major: 30, minor: 10 };
}

// ─── Track grouping ────────────────────────────────────────────────────────────
function groupByTrack(clips: VideoClip[]): Map<number, VideoClip[]> {
  const map = new Map<number, VideoClip[]>();
  clips.forEach((c) => {
    if (!map.has(c.trackIndex)) map.set(c.trackIndex, []);
    map.get(c.trackIndex)!.push(c);
  });
  const maxTrack = clips.length ? Math.max(...clips.map((c) => c.trackIndex)) : -1;
  for (let i = 0; i <= maxTrack; i++) {
    if (!map.has(i)) map.set(i, []);
  }
  return map;
}

// ─── Drag state type ──────────────────────────────────────────────────────────
type DragMode = 'move' | 'trim-left' | 'trim-right' | 'playhead' | null;
interface DragState {
  mode: DragMode;
  clipId: string | null;
  startX: number;
  origStart: number;
  origTrimStart: number;
  origTrimEnd: number;
}

// ─── Ruler ────────────────────────────────────────────────────────────────────
function TimeRuler({
  duration, pxPerSec, playhead, scrollLeft, onSeek,
}: {
  duration: number;
  pxPerSec: number;
  playhead: number;
  scrollLeft: number;
  onSeek: (t: number) => void;
}) {
  const { major, minor } = tickConfig(pxPerSec);
  const totalW = Math.ceil(duration * pxPerSec) + 80;
  const ticks: { t: number; isMajor: boolean }[] = [];
  let t = 0;
  while (t <= duration + major) {
    ticks.push({ t, isMajor: Math.round(t / major) * major === t && t % major < minor * 0.5 });
    t = Math.round((t + minor) * 1000) / 1000;
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left + scrollLeft;
    onSeek(Math.max(0, x / pxPerSec));
  };

  return (
    <div
      style={{
        height: RULER_H,
        width: totalW,
        position: 'relative',
        cursor: 'col-resize',
        userSelect: 'none',
        flexShrink: 0,
      }}
      onMouseDown={handleMouseDown}
    >
      <div style={{ position: 'absolute', inset: 0, background: '#0b0f1a' }} />

      {ticks.map(({ t: time, isMajor }) => {
        const x = time * pxPerSec;
        if (x < scrollLeft - 60 || x > scrollLeft + 2000) return null;
        return (
          <div
            key={time}
            style={{
              position: 'absolute', left: x, top: 0,
              width: 0, height: '100%', overflow: 'visible', pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute', left: 0,
                top: isMajor ? 8 : 14,
                width: 1,
                height: isMajor ? 16 : 10,
                background: isMajor ? '#4b5563' : '#1f2937',
              }}
            />
            {isMajor && (
              <span
                style={{
                  position: 'absolute', left: 3, top: 4,
                  fontSize: 9, color: '#6b7280',
                  pointerEvents: 'none', userSelect: 'none',
                  lineHeight: 1, whiteSpace: 'nowrap',
                }}
              >
                {fmt(time)}
              </span>
            )}
          </div>
        );
      })}

      <div
        style={{
          position: 'absolute', left: playhead * pxPerSec, top: 0,
          width: 2, height: RULER_H, background: '#ef4444', pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// ─── Clip block ───────────────────────────────────────────────────────────────
function ClipBlock({
  clip, pxPerSec, isSelected, color,
  onMouseDown, onTrimLeft, onTrimRight, onDelete, onClick,
  onTransitionIn, onTransitionOut,
  inTransitionType, outTransitionType,
}: {
  clip: VideoClip;
  pxPerSec: number;
  isSelected: boolean;
  color: string;
  onMouseDown: (e: React.MouseEvent) => void;
  onTrimLeft: (e: React.MouseEvent) => void;
  onTrimRight: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onClick: () => void;
  onTransitionIn: (e: React.MouseEvent) => void;
  onTransitionOut: (e: React.MouseEvent) => void;
  inTransitionType?: TransitionType;
  outTransitionType?: TransitionType;
}) {
  const effLen = clip.trimEnd - clip.trimStart;
  const left = clip.startTime * pxPerSec;
  const width = Math.max(effLen * pxPerSec, 16);

  return (
    <div
      style={{
        position: 'absolute', left, top: 4,
        height: TRACK_H - 8, width,
        borderRadius: 5, overflow: 'hidden',
        background: color,
        border: `2px solid ${isSelected ? '#fff' : 'rgba(255,255,255,0.15)'}`,
        boxShadow: isSelected ? `0 0 0 1px ${color}, 0 2px 8px rgba(0,0,0,0.4)` : '0 1px 4px rgba(0,0,0,0.3)',
        cursor: 'grab', userSelect: 'none',
        display: 'flex', alignItems: 'center',
      }}
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e); }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {/* Thumbnail strip */}
      {clip.thumbnail && (
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${clip.thumbnail})`,
            backgroundSize: 'auto 100%', backgroundRepeat: 'repeat-x', opacity: 0.3,
          }}
        />
      )}

      {/* In-transition gradient zone */}
      <div
        title={inTransitionType ? `In: ${inTransitionType} (click to change)` : 'Add in-transition'}
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 12, zIndex: 3,
          cursor: 'pointer',
          background: inTransitionType
            ? 'linear-gradient(to right, rgba(251,191,36,0.7), transparent)'
            : 'transparent',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onTransitionIn(e); }}
        onMouseEnter={(e) => {
          if (!inTransitionType)
            (e.currentTarget as HTMLElement).style.background = 'linear-gradient(to right, rgba(99,102,241,0.4), transparent)';
        }}
        onMouseLeave={(e) => {
          if (!inTransitionType)
            (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      />

      {/* Left trim handle */}
      <div
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 8,
          cursor: 'ew-resize', zIndex: 2,
          background: 'rgba(255,255,255,0.25)', borderRadius: '3px 0 0 3px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onMouseDown={(e) => { e.stopPropagation(); onTrimLeft(e); }}
      >
        <div style={{ width: 2, height: 12, background: 'rgba(255,255,255,0.7)', borderRadius: 1 }} />
      </div>

      {/* Label */}
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center',
          paddingLeft: 12, paddingRight: 28, overflow: 'hidden', zIndex: 1,
        }}
      >
        <Film size={10} style={{ color: 'rgba(255,255,255,0.7)', marginRight: 4, flexShrink: 0 }} />
        <span style={{
          fontSize: 10, color: '#e2e8f0', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {clip.name}
        </span>
      </div>

      {/* Out-transition gradient zone */}
      <div
        title={outTransitionType ? `Out: ${outTransitionType} (click to change)` : 'Add out-transition'}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 12, zIndex: 3,
          cursor: 'pointer',
          background: outTransitionType
            ? 'linear-gradient(to left, rgba(251,191,36,0.7), transparent)'
            : 'transparent',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onTransitionOut(e); }}
        onMouseEnter={(e) => {
          if (!outTransitionType)
            (e.currentTarget as HTMLElement).style.background = 'linear-gradient(to left, rgba(99,102,241,0.4), transparent)';
        }}
        onMouseLeave={(e) => {
          if (!outTransitionType)
            (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      />

      {/* Right trim handle */}
      <div
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 8,
          cursor: 'ew-resize', zIndex: 2,
          background: 'rgba(255,255,255,0.25)', borderRadius: '0 3px 3px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onMouseDown={(e) => { e.stopPropagation(); onTrimRight(e); }}
      >
        <div style={{ width: 2, height: 12, background: 'rgba(255,255,255,0.7)', borderRadius: 1 }} />
      </div>

      {/* Delete on hover */}
      <button
        style={{
          position: 'absolute', top: 2, right: 12, zIndex: 4,
          background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 3,
          padding: '1px 3px', cursor: 'pointer', color: '#f87171',
          opacity: 0, transition: 'opacity 120ms',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}
        title="Remove clip"
      >
        <Trash2 size={9} />
      </button>
    </div>
  );
}

// ─── Transition picker popover ────────────────────────────────────────────────
function TransitionPopover({
  clipId, position, x, y, onClose, maxDuration,
}: {
  clipId: string;
  position: 'in' | 'out';
  x: number;
  y: number;
  onClose: () => void;
  maxDuration: number;
}) {
  const { addTransition, removeTransition, transitions } = useKeyframesStore();
  const [duration, setDuration] = useState(0.4);

  const existing = transitions.find(
    (t) => t.clipId === clipId && t.position === position
  );

  const handlePick = (type: TransitionType) => {
    addTransition({ clipId, type, position, duration });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div
        style={{
          position: 'fixed',
          left: Math.min(x, window.innerWidth - 210),
          top: Math.min(y, window.innerHeight - 270),
          zIndex: 40,
          background: '#1e2535',
          border: '1px solid #2d3748',
          borderRadius: 10,
          padding: 12,
          width: 200,
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{ fontSize: 10, color: '#818cf8', fontWeight: 600, marginBottom: 8 }}>
          {position === 'in' ? 'In' : 'Out'} Transition
        </div>

        {existing && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
              padding: '4px 8px', borderRadius: 5,
              background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)',
            }}
          >
            <span style={{ fontSize: 9, color: '#fbbf24', flex: 1 }}>
              {TRANSITION_DEFS.find(d => d.type === existing.type)?.icon}{' '}
              {TRANSITION_DEFS.find(d => d.type === existing.type)?.label}
              {' '}· {existing.duration.toFixed(1)}s
            </span>
            <button
              onClick={() => { removeTransition(existing.id); onClose(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: 2 }}
            >
              <Trash2 size={9} />
            </button>
          </div>
        )}

        {/* Duration */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 9, color: '#6b7280' }}>Duration</span>
            <span style={{ fontSize: 9, color: '#9ca3af' }}>{duration.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={0.1} max={Math.max(0.1, Math.min(maxDuration, 2))} step={0.1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#6366f1' }}
          />
        </div>

        {/* Transition grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
          {TRANSITION_DEFS.map((def) => (
            <button
              key={def.type}
              onClick={() => handlePick(def.type)}
              title={def.label}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '5px 2px', borderRadius: 5, cursor: 'pointer',
                background: existing?.type === def.type ? 'rgba(99,102,241,0.2)' : '#0b0f1a',
                border: `1px solid ${existing?.type === def.type ? 'rgba(99,102,241,0.5)' : '#1f2937'}`,
                color: existing?.type === def.type ? '#818cf8' : '#6b7280',
                fontSize: 7, gap: 2,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#6366f1';
                (e.currentTarget as HTMLElement).style.color = '#818cf8';
              }}
              onMouseLeave={(e) => {
                if (existing?.type !== def.type) {
                  (e.currentTarget as HTMLElement).style.borderColor = '#1f2937';
                  (e.currentTarget as HTMLElement).style.color = '#6b7280';
                }
              }}
            >
              <span style={{ fontSize: 12 }}>{def.icon}</span>
              <span style={{ lineHeight: 1.2, textAlign: 'center' }}>{def.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Keyframes row ────────────────────────────────────────────────────────────
const KF_PROP_COLORS: Record<string, string> = {
  opacity: '#f59e0b', left: '#6366f1', top: '#8b5cf6',
  scaleX: '#10b981', scaleY: '#06b6d4', angle: '#f43f5e',
  skewX: '#fb923c', skewY: '#84cc16',
};

function KeyframesRow({
  pxPerSec, width, objectIds,
}: {
  pxPerSec: number;
  width: number;
  objectIds: string[];
}) {
  const { keyframes, removeKeyframe } = useKeyframesStore();
  const relevant = keyframes.filter((k) => objectIds.includes(k.objectId));

  if (relevant.length === 0) return null;

  return (
    <div
      style={{
        height: KF_ROW_H, width, position: 'relative',
        background: '#080c14',
        borderBottom: '1px solid #111827',
      }}
    >
      {relevant.map((kf) => {
        const x = kf.time * pxPerSec;
        const color = KF_PROP_COLORS[kf.property] ?? '#818cf8';
        return (
          <div
            key={kf.id}
            title={`${kf.property}: ${kf.value.toFixed(1)} @ ${kf.time.toFixed(2)}s — click to delete`}
            onClick={() => removeKeyframe(kf.id)}
            style={{
              position: 'absolute',
              left: x - 4,
              top: KF_ROW_H / 2 - 4,
              width: 8, height: 8,
              background: color,
              transform: 'rotate(45deg)',
              cursor: 'pointer',
              borderRadius: 1,
              boxShadow: `0 0 4px ${color}88`,
              zIndex: 2,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'rotate(45deg) scale(1.4)';
              (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${color}`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'rotate(45deg) scale(1)';
              (e.currentTarget as HTMLElement).style.boxShadow = `0 0 4px ${color}88`;
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface VideoTimelineProps {
  onClose: () => void;
}

export function VideoTimeline({ onClose }: VideoTimelineProps) {
  const {
    clips, playhead, isPlaying, totalDuration, timelineZoom,
    play, pause, stop, setPlayhead, setTimelineZoom,
    moveClip, setTrim, removeClip, updateClip,
  } = useVideoStore();
  const { canvas, selectedObjects, setSelectedObjects } = useEditorStore();
  const { keyframes, transitions } = useKeyframesStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const dragRef = useRef<DragState>({
    mode: null, clipId: null, startX: 0, origStart: 0, origTrimStart: 0, origTrimEnd: 0,
  });
  const [, forceUpdate] = useState(0);

  // Transition picker state
  const [transitionPicker, setTransitionPicker] = useState<{
    clipId: string;
    position: 'in' | 'out';
    x: number;
    y: number;
  } | null>(null);

  const pxPerSec = timelineZoom;
  const totalW = Math.ceil(totalDuration * pxPerSec) + 120;
  const tracks = groupByTrack(clips);

  const selectedFabricId = (selectedObjects[0] as any)?.__videoClipId ?? null;

  // All object IDs that have keyframes (for the KF row)
  const animatedObjectIds = Array.from(new Set(keyframes.map((k) => k.objectId)));

  // ── Space → play/pause ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        isPlaying ? pause() : play();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPlaying, play, pause]);

  // ── Scroll sync ──────────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    setScrollLeft(scrollRef.current?.scrollLeft ?? 0);
  }, []);

  // Auto-scroll to keep playhead visible
  useEffect(() => {
    if (!isPlaying || !scrollRef.current) return;
    const playheadPx = playhead * pxPerSec;
    const el = scrollRef.current;
    if (playheadPx > el.scrollLeft + el.clientWidth - 60) {
      el.scrollLeft = playheadPx - 60;
    }
  }, [playhead, isPlaying, pxPerSec]);

  // ── Zoom via Ctrl+wheel ──────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        setTimelineZoom(Math.max(10, Math.min(500, pxPerSec * factor)));
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [pxPerSec, setTimelineZoom]);

  // ── Global drag ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d.mode) return;
      const dx = e.clientX - d.startX;
      const dt = dx / pxPerSec;

      if (d.mode === 'playhead') {
        setPlayhead(d.origStart + dt);
        return;
      }
      if (!d.clipId) return;
      const clip = useVideoStore.getState().clips.find((c) => c.id === d.clipId);
      if (!clip) return;

      if (d.mode === 'move') {
        moveClip(d.clipId, Math.max(0, d.origStart + dt));
      } else if (d.mode === 'trim-left') {
        const newTrimStart = Math.max(0, d.origTrimStart + dt);
        const trimDelta = newTrimStart - d.origTrimStart;
        setTrim(d.clipId, newTrimStart, d.origTrimEnd);
        moveClip(d.clipId, Math.max(0, d.origStart + trimDelta));
      } else if (d.mode === 'trim-right') {
        const newTrimEnd = Math.min(clip.duration, d.origTrimEnd + dt);
        setTrim(d.clipId, d.origTrimStart, newTrimEnd);
      }
      forceUpdate((n) => n + 1);
    };

    const onUp = () => {
      dragRef.current = { mode: null, clipId: null, startX: 0, origStart: 0, origTrimStart: 0, origTrimEnd: 0 };
      forceUpdate((n) => n + 1);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [pxPerSec, moveClip, setTrim, setPlayhead]);

  const handleRulerSeek = useCallback((t: number) => {
    pause();
    setPlayhead(t);
  }, [pause, setPlayhead]);

  const startPlayheadDrag = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dragRef.current = { mode: 'playhead', clipId: null, startX: e.clientX, origStart: playhead, origTrimStart: 0, origTrimEnd: 0 };
  }, [playhead]);

  const startClipDrag = useCallback((clipId: string, e: React.MouseEvent) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;
    dragRef.current = { mode: 'move', clipId, startX: e.clientX, origStart: clip.startTime, origTrimStart: clip.trimStart, origTrimEnd: clip.trimEnd };
  }, [clips]);

  const startTrimLeft = useCallback((clipId: string, e: React.MouseEvent) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;
    e.preventDefault();
    dragRef.current = { mode: 'trim-left', clipId, startX: e.clientX, origStart: clip.startTime, origTrimStart: clip.trimStart, origTrimEnd: clip.trimEnd };
  }, [clips]);

  const startTrimRight = useCallback((clipId: string, e: React.MouseEvent) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;
    e.preventDefault();
    dragRef.current = { mode: 'trim-right', clipId, startX: e.clientX, origStart: clip.startTime, origTrimStart: clip.trimStart, origTrimEnd: clip.trimEnd };
  }, [clips]);

  const selectClip = useCallback((clipId: string) => {
    const fabObj = fabricVideoMap.get(clipId);
    if (canvas && fabObj) {
      canvas.setActiveObject(fabObj);
      canvas.requestRenderAll();
      setSelectedObjects([fabObj]);
    }
  }, [canvas, setSelectedObjects]);

  const handleTransitionTrigger = useCallback((
    clipId: string,
    position: 'in' | 'out',
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setTransitionPicker({ clipId, position, x: e.clientX, y: e.clientY });
  }, []);

  const playheadX = playhead * pxPerSec;

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column',
        height: 240,
        background: '#0b0f1a', borderTop: '1px solid #1f2937',
        userSelect: 'none', flexShrink: 0,
      }}
    >
      {/* ── Transport bar ──────────────────────────────────────────────── */}
      <div
        style={{
          height: 38, background: '#111827', borderBottom: '1px solid #1f2937',
          display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', flexShrink: 0,
        }}
      >
        <TransportBtn onClick={stop} title="Stop"><StopCircle size={14} /></TransportBtn>
        <TransportBtn onClick={() => setPlayhead(0)} title="Go to start"><SkipBack size={14} /></TransportBtn>
        <TransportBtn onClick={isPlaying ? pause : play} title={isPlaying ? 'Pause (Space)' : 'Play (Space)'} active>
          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
        </TransportBtn>
        <TransportBtn onClick={() => setPlayhead(totalDuration)} title="Go to end"><SkipForward size={14} /></TransportBtn>

        <div style={{ width: 1, height: 18, background: '#1f2937', margin: '0 4px' }} />

        {/* Time display */}
        <div
          style={{
            fontFamily: 'monospace', fontSize: 12, color: '#d1d5db',
            background: '#0b0f1a', border: '1px solid #1f2937', borderRadius: 5,
            padding: '2px 8px', minWidth: 140, textAlign: 'center',
          }}
        >
          <span style={{ color: '#e2e8f0' }}>{fmt(playhead)}</span>
          <span style={{ color: '#374151' }}> / </span>
          <span style={{ color: '#6b7280' }}>{fmt(totalDuration)}</span>
        </div>

        <div style={{ width: 1, height: 18, background: '#1f2937', margin: '0 4px' }} />

        <TransportBtn onClick={() => setTimelineZoom(Math.max(10, pxPerSec / 1.5))} title="Zoom out">
          <ZoomOut size={13} />
        </TransportBtn>
        <input
          type="range" min={10} max={400} value={pxPerSec}
          onChange={(e) => setTimelineZoom(Number(e.target.value))}
          style={{ width: 72, accentColor: '#6366f1' }}
          title="Timeline zoom"
        />
        <TransportBtn onClick={() => setTimelineZoom(Math.min(400, pxPerSec * 1.5))} title="Zoom in">
          <ZoomIn size={13} />
        </TransportBtn>

        {/* Keyframe indicator */}
        {keyframes.length > 0 && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 5,
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            <div style={{ width: 6, height: 6, background: '#f59e0b', transform: 'rotate(45deg)', borderRadius: 1 }} />
            <span style={{ fontSize: 9, color: '#f59e0b' }}>{keyframes.length} KF</span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: 'none', color: '#4b5563',
            cursor: 'pointer', padding: '3px 6px', borderRadius: 4, fontSize: 11,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#9ca3af'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#4b5563'; }}
          title="Close timeline"
        >
          ✕
        </button>
      </div>

      {/* ── Timeline body ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Track labels */}
        <div
          style={{
            width: LABEL_W, flexShrink: 0,
            background: '#111827', borderRight: '1px solid #1f2937',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ height: RULER_H, flexShrink: 0, borderBottom: '1px solid #1f2937' }} />

          {Array.from(tracks.entries()).sort(([a], [b]) => a - b).map(([idx, trackClips]) => (
            <React.Fragment key={idx}>
              <div
                style={{
                  height: TRACK_H, flexShrink: 0,
                  borderBottom: '1px solid #1f2937',
                  display: 'flex', alignItems: 'center',
                  paddingLeft: 8, paddingRight: 4, gap: 4,
                }}
              >
                <Film size={11} style={{ color: '#4b5563', flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Track {idx + 1}
                </span>
                <span style={{ fontSize: 9, color: '#374151' }}>{trackClips.length}</span>
              </div>
              {/* KF label row */}
              {animatedObjectIds.length > 0 && (
                <div
                  style={{
                    height: KF_ROW_H, flexShrink: 0,
                    borderBottom: '1px solid #111827',
                    display: 'flex', alignItems: 'center',
                    paddingLeft: 8,
                  }}
                >
                  <div style={{ width: 5, height: 5, background: '#f59e0b', transform: 'rotate(45deg)', borderRadius: 1, marginRight: 4 }} />
                  <span style={{ fontSize: 8, color: '#374151' }}>Keyframes</span>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}
          onScroll={handleScroll}
        >
          <div style={{ width: totalW, position: 'relative' }}>

            {/* Ruler */}
            <TimeRuler
              duration={totalDuration}
              pxPerSec={pxPerSec}
              playhead={playhead}
              scrollLeft={scrollLeft}
              onSeek={handleRulerSeek}
            />

            {/* Track rows */}
            {Array.from(tracks.entries()).sort(([a], [b]) => a - b).map(([trackIdx, trackClips]) => (
              <React.Fragment key={trackIdx}>
                <div
                  style={{
                    height: TRACK_H, position: 'relative',
                    borderBottom: '1px solid #111827',
                    background: trackIdx % 2 === 0 ? '#0d1117' : '#0b0f1a',
                  }}
                >
                  {trackClips.map((clip) => {
                    const inTr  = transitions.find((t) => t.clipId === clip.id && t.position === 'in');
                    const outTr = transitions.find((t) => t.clipId === clip.id && t.position === 'out');
                    return (
                      <ClipBlock
                        key={clip.id}
                        clip={clip}
                        pxPerSec={pxPerSec}
                        isSelected={clip.id === selectedFabricId}
                        color={CLIP_COLORS[trackIdx % CLIP_COLORS.length]}
                        onMouseDown={(e) => startClipDrag(clip.id, e)}
                        onTrimLeft={(e) => startTrimLeft(clip.id, e)}
                        onTrimRight={(e) => startTrimRight(clip.id, e)}
                        onDelete={() => removeClip(clip.id)}
                        onClick={() => selectClip(clip.id)}
                        onTransitionIn={(e) => handleTransitionTrigger(clip.id, 'in', e)}
                        onTransitionOut={(e) => handleTransitionTrigger(clip.id, 'out', e)}
                        inTransitionType={inTr?.type}
                        outTransitionType={outTr?.type}
                      />
                    );
                  })}
                </div>

                {/* Keyframe diamonds row */}
                {animatedObjectIds.length > 0 && (
                  <KeyframesRow
                    pxPerSec={pxPerSec}
                    width={totalW}
                    objectIds={animatedObjectIds}
                  />
                )}
              </React.Fragment>
            ))}

            {/* Empty state */}
            {clips.length === 0 && (
              <div
                style={{
                  height: TRACK_H * 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#374151', fontSize: 12,
                }}
              >
                Add a video clip from the Videos panel →
              </div>
            )}

            {/* Playhead line */}
            <div
              style={{
                position: 'absolute', left: playheadX, top: 0, bottom: 0,
                width: 2, background: '#ef4444', zIndex: 10, pointerEvents: 'none',
              }}
            />

            {/* Playhead drag diamond */}
            <div
              style={{
                position: 'absolute',
                left: playheadX - 6, top: RULER_H - 10,
                width: 14, height: 14,
                background: '#ef4444', transform: 'rotate(45deg)',
                cursor: 'col-resize', zIndex: 11,
                boxShadow: '0 2px 6px rgba(239,68,68,0.5)',
              }}
              onMouseDown={startPlayheadDrag}
            />
          </div>
        </div>
      </div>

      {/* Transition picker */}
      {transitionPicker && (
        <TransitionPopover
          clipId={transitionPicker.clipId}
          position={transitionPicker.position}
          x={transitionPicker.x}
          y={transitionPicker.y}
          onClose={() => setTransitionPicker(null)}
          maxDuration={(() => {
            const c = clips.find(cl => cl.id === transitionPicker.clipId);
            return c ? (c.trimEnd - c.trimStart) / 2 : 1;
          })()}
        />
      )}
    </div>
  );
}

// ─── Transport button ─────────────────────────────────────────────────────────
function TransportBtn({
  onClick, title, children, active,
}: {
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
        border: active ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
        borderRadius: 6,
        color: active ? '#818cf8' : '#6b7280',
        cursor: 'pointer', padding: '3px 6px',
        display: 'flex', alignItems: 'center',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = '#9ca3af';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = '#6b7280';
      }}
    >
      {children}
    </button>
  );
}
