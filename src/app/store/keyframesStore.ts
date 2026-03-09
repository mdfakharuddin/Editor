/**
 * keyframesStore — Animation keyframe & transition state management
 *
 * ─── Data Model ────────────────────────────────────────────────────────────────
 *
 * Keyframe
 *   A single time-property-value triplet for one Fabric object property.
 *   Example: { objectId: 'obj_1', property: 'opacity', time: 1.0, value: 0 }
 *
 * Transition
 *   A clip-level in/out animation applied at the clip's start or end.
 *   Example: { clipId: 'c1', type: 'fade', position: 'in', duration: 0.5 }
 *
 * ─── Interpolation ─────────────────────────────────────────────────────────────
 *   getInterpolatedValue(objectId, property, time) walks all keyframes for that
 *   object+property, finds the bracket [kA, kB] around `time`, and lerps with
 *   the chosen easing function. Called by the renderer on every RAF tick.
 *
 * ─── Sync to Canvas ────────────────────────────────────────────────────────────
 *   applyKeyframesAtTime(canvas, time) iterates every animated object and calls
 *   fabricObj.set(property, value) for each animated property, then calls
 *   canvas.requestRenderAll(). This is called from useVideoRenderer.ts.
 *
 * ─── JSON Schema Example ───────────────────────────────────────────────────────
 *   keyframes: [
 *     { id, objectId, property: 'opacity', time: 0,   value: 0,    easing: 'linear' },
 *     { id, objectId, property: 'opacity', time: 0.5, value: 1,    easing: 'ease-out' },
 *     { id, objectId, property: 'left',    time: 0,   value: -200, easing: 'ease-in-out' },
 *     { id, objectId, property: 'left',    time: 1,   value: 400,  easing: 'ease-in-out' },
 *   ]
 *   transitions: [
 *     { id, clipId, type: 'fade', position: 'in',  duration: 0.4 },
 *     { id, clipId, type: 'wipe-left', position: 'out', duration: 0.3 },
 *   ]
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
export type AnimatableProperty =
  | 'opacity' | 'left' | 'top' | 'scaleX' | 'scaleY' | 'angle'
  | 'skewX' | 'skewY';

export type TransitionType =
  | 'fade' | 'dissolve' | 'wipe-left' | 'wipe-right'
  | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out';
export type TransitionPosition = 'in' | 'out';

export interface Keyframe {
  id: string;
  objectId: string;           // fabric object's __id
  property: AnimatableProperty;
  time: number;               // absolute seconds on the timeline
  value: number;
  easing: EasingType;
}

export interface ClipTransition {
  id: string;
  clipId: string;             // videoStore clip id
  type: TransitionType;
  position: TransitionPosition; // 'in' = at clip start, 'out' = at clip end
  duration: number;           // seconds (must be ≤ half the clip effective length)
}

interface KeyframesState {
  keyframes: Keyframe[];
  transitions: ClipTransition[];

  // Keyframe CRUD
  addKeyframe: (kf: Omit<Keyframe, 'id'>) => void;
  updateKeyframe: (id: string, updates: Partial<Omit<Keyframe, 'id'>>) => void;
  removeKeyframe: (id: string) => void;
  removeKeyframesForObject: (objectId: string) => void;

  // Transition CRUD
  addTransition: (tr: Omit<ClipTransition, 'id'>) => void;
  updateTransition: (id: string, updates: Partial<Omit<ClipTransition, 'id'>>) => void;
  removeTransition: (id: string) => void;
  removeTransitionsForClip: (clipId: string) => void;

  // Query
  getKeyframesForObject: (objectId: string) => Keyframe[];
  getTransitionsForClip: (clipId: string) => ClipTransition[];
}

let kfIdCounter = 0;
const kfId = () => `kf_${Date.now()}_${++kfIdCounter}`;
let trIdCounter = 0;
const trId = () => `tr_${Date.now()}_${++trIdCounter}`;

export const useKeyframesStore = create<KeyframesState>()(
  subscribeWithSelector((set, get) => ({
    keyframes: [],
    transitions: [],

    addKeyframe: (kf) =>
      set((s) => ({
        keyframes: [...s.keyframes, { ...kf, id: kfId() }],
      })),

    updateKeyframe: (id, updates) =>
      set((s) => ({
        keyframes: s.keyframes.map((k) => (k.id === id ? { ...k, ...updates } : k)),
      })),

    removeKeyframe: (id) =>
      set((s) => ({ keyframes: s.keyframes.filter((k) => k.id !== id) })),

    removeKeyframesForObject: (objectId) =>
      set((s) => ({ keyframes: s.keyframes.filter((k) => k.objectId !== objectId) })),

    addTransition: (tr) =>
      set((s) => {
        // Replace any existing transition for the same clip+position
        const filtered = s.transitions.filter(
          (t) => !(t.clipId === tr.clipId && t.position === tr.position)
        );
        return { transitions: [...filtered, { ...tr, id: trId() }] };
      }),

    updateTransition: (id, updates) =>
      set((s) => ({
        transitions: s.transitions.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      })),

    removeTransition: (id) =>
      set((s) => ({ transitions: s.transitions.filter((t) => t.id !== id) })),

    removeTransitionsForClip: (clipId) =>
      set((s) => ({ transitions: s.transitions.filter((t) => t.clipId !== clipId) })),

    getKeyframesForObject: (objectId) =>
      get().keyframes.filter((k) => k.objectId === objectId),

    getTransitionsForClip: (clipId) =>
      get().transitions.filter((t) => t.clipId === clipId),
  }))
);

// ─── Easing functions ─────────────────────────────────────────────────────────

function easeIn(t: number) { return t * t; }
function easeOut(t: number) { return t * (2 - t); }
function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

function applyEasing(t: number, easing: EasingType): number {
  if (easing === 'ease-in')     return easeIn(t);
  if (easing === 'ease-out')    return easeOut(t);
  if (easing === 'ease-in-out') return easeInOut(t);
  return t; // linear
}

// ─── Interpolation ────────────────────────────────────────────────────────────

/**
 * getInterpolatedValue
 * Returns the interpolated numeric value of a Fabric property at `time`.
 * If no keyframes exist for the pair, returns null.
 */
export function getInterpolatedValue(
  objectId: string,
  property: AnimatableProperty,
  time: number
): number | null {
  const { keyframes } = useKeyframesStore.getState();
  const kfs = keyframes
    .filter((k) => k.objectId === objectId && k.property === property)
    .sort((a, b) => a.time - b.time);

  if (!kfs.length) return null;
  if (time <= kfs[0].time) return kfs[0].value;
  if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;

  // Find bracket
  let lo = kfs[0], hi = kfs[1];
  for (let i = 1; i < kfs.length; i++) {
    if (kfs[i].time >= time) { lo = kfs[i - 1]; hi = kfs[i]; break; }
  }

  const span = hi.time - lo.time;
  if (span === 0) return lo.value;

  const t = applyEasing((time - lo.time) / span, lo.easing);
  return lo.value + (hi.value - lo.value) * t;
}

/**
 * applyKeyframesAtTime
 * Applies all animated property values at `time` to their Fabric objects.
 * Call this from the render loop AFTER advancing the playhead.
 */
export function applyKeyframesAtTime(canvas: any, time: number): void {
  if (!canvas) return;
  const { keyframes } = useKeyframesStore.getState();
  if (!keyframes.length) return;

  // Group by objectId
  const byObject = new Map<string, Set<AnimatableProperty>>();
  keyframes.forEach((k) => {
    if (!byObject.has(k.objectId)) byObject.set(k.objectId, new Set());
    byObject.get(k.objectId)!.add(k.property);
  });

  let changed = false;
  byObject.forEach((properties, objectId) => {
    const fabObj = canvas.getObjects().find((o: any) => o.__id === objectId);
    if (!fabObj) return;
    properties.forEach((prop) => {
      const val = getInterpolatedValue(objectId, prop, time);
      if (val !== null) {
        fabObj.set(prop as any, val);
        changed = true;
      }
    });
  });

  if (changed) canvas.requestRenderAll();
}

/**
 * getTransitionOpacity
 * Returns the opacity multiplier (0–1) for a clip at the given playhead time,
 * considering its in/out transitions. Used by the renderer to apply fade effects
 * to the fabric.Image directly.
 */
export function getTransitionOpacity(
  clipId: string,
  clipStart: number,
  clipEffectiveEnd: number,
  time: number
): number {
  const { transitions } = useKeyframesStore.getState();
  const clipTransitions = transitions.filter((t) => t.clipId === clipId);

  let opacity = 1;

  const inTr = clipTransitions.find((t) => t.position === 'in');
  if (inTr) {
    const progress = (time - clipStart) / inTr.duration;
    if (progress < 1) opacity = Math.min(opacity, Math.max(0, progress));
  }

  const outTr = clipTransitions.find((t) => t.position === 'out');
  if (outTr) {
    const timeFromEnd = clipEffectiveEnd - time;
    const progress = timeFromEnd / outTr.duration;
    if (progress < 1) opacity = Math.min(opacity, Math.max(0, progress));
  }

  return opacity;
}

// ─── TRANSITION_DEFS — label + icon info for the UI ──────────────────────────

export const TRANSITION_DEFS: { type: TransitionType; label: string; icon: string }[] = [
  { type: 'fade',        label: 'Fade',        icon: '◑' },
  { type: 'dissolve',    label: 'Dissolve',    icon: '⬚' },
  { type: 'wipe-left',   label: 'Wipe →',     icon: '▷' },
  { type: 'wipe-right',  label: 'Wipe ←',     icon: '◁' },
  { type: 'slide-left',  label: 'Slide →',    icon: '→' },
  { type: 'slide-right', label: 'Slide ←',    icon: '←' },
  { type: 'zoom-in',     label: 'Zoom In',     icon: '⊕' },
  { type: 'zoom-out',    label: 'Zoom Out',    icon: '⊖' },
];

// ─── ANIMATABLE_PROPERTIES — shown in the keyframe property picker ────────────

export const ANIMATABLE_PROPERTIES: { value: AnimatableProperty; label: string }[] = [
  { value: 'opacity', label: 'Opacity' },
  { value: 'left',    label: 'X Position' },
  { value: 'top',     label: 'Y Position' },
  { value: 'scaleX',  label: 'Scale X' },
  { value: 'scaleY',  label: 'Scale Y' },
  { value: 'angle',   label: 'Rotation' },
  { value: 'skewX',   label: 'Skew X' },
  { value: 'skewY',   label: 'Skew Y' },
];
