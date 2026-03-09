/**
 * AnimatePanel — Keyframe & transition editor for the selected canvas object.
 *
 * Shown in the RightSidebar "Animate" tab.
 *
 * Features:
 *  • Add a keyframe for any AnimatableProperty at the current playhead
 *  • View all keyframes grouped by property
 *  • Edit easing per keyframe
 *  • Delete individual keyframes
 *  • Add/remove clip transitions (fade-in / fade-out) for selected video clips
 */

import { useState } from 'react';
import {
  Diamond, Plus, Trash2, ChevronDown, Zap, Film,
} from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore';
import { useVideoStore } from '../../../store/videoStore';
import {
  useKeyframesStore,
  ANIMATABLE_PROPERTIES,
  TRANSITION_DEFS,
  type AnimatableProperty,
  type EasingType,
  type TransitionType,
} from '../../../store/keyframesStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(s: number) {
  return `${s.toFixed(2)}s`;
}

const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: 'linear',       label: 'Linear' },
  { value: 'ease-in',      label: 'Ease In' },
  { value: 'ease-out',     label: 'Ease Out' },
  { value: 'ease-in-out',  label: 'Ease In-Out' },
];

const PROP_COLORS: Record<AnimatableProperty, string> = {
  opacity: '#f59e0b',
  left:    '#6366f1',
  top:     '#8b5cf6',
  scaleX:  '#10b981',
  scaleY:  '#06b6d4',
  angle:   '#f43f5e',
  skewX:   '#fb923c',
  skewY:   '#84cc16',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9, color: '#4b5563', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function KfRow({
  time, value, easing, property, onDelete, onEasingChange,
}: {
  time: number;
  value: number;
  easing: EasingType;
  property: AnimatableProperty;
  onDelete: () => void;
  onEasingChange: (e: EasingType) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 6px', borderRadius: 6,
        background: '#1a2236',
        border: '1px solid #21283a',
        marginBottom: 3,
      }}
    >
      <Diamond
        size={8}
        style={{ color: PROP_COLORS[property], fill: PROP_COLORS[property], flexShrink: 0 }}
      />
      <span style={{ fontSize: 10, color: '#9ca3af', minWidth: 34 }}>{fmt(time)}</span>
      <span style={{ fontSize: 10, color: '#d1d5db', flex: 1 }}>
        {Number.isFinite(value) ? value.toFixed(1) : '—'}
      </span>

      {/* Easing select */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen((p) => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 3,
            padding: '2px 6px', borderRadius: 4,
            background: '#21283a', border: '1px solid #2d3748',
            color: '#6b7280', fontSize: 9, cursor: 'pointer',
          }}
        >
          {easing}
          <ChevronDown size={8} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div
              style={{
                position: 'absolute', bottom: '100%', right: 0, zIndex: 20,
                background: '#1e2535', border: '1px solid #2d3748',
                borderRadius: 6, padding: 4, minWidth: 100,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}
            >
              {EASING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { onEasingChange(opt.value); setOpen(false); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '4px 8px', fontSize: 10, cursor: 'pointer',
                    borderRadius: 4, border: 'none', background: 'transparent',
                    color: easing === opt.value ? '#818cf8' : '#9ca3af',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button
        onClick={onDelete}
        title="Delete keyframe"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#374151', padding: 2, display: 'flex', alignItems: 'center',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#374151'; }}
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ reason }: { reason: 'no-selection' | 'no-timeline' }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: 8, padding: 20,
      }}
    >
      <Zap size={24} style={{ color: '#2d3748' }} />
      <p style={{ fontSize: 11, color: '#4b5563', textAlign: 'center', lineHeight: 1.5 }}>
        {reason === 'no-selection'
          ? 'Select an object on the canvas to add keyframes.'
          : 'Open the Timeline panel to use animation keyframes.'}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnimatePanel() {
  const { selectedObjects } = useEditorStore();
  const { playhead, clips } = useVideoStore();
  const {
    keyframes, addKeyframe, removeKeyframe, updateKeyframe,
    transitions, addTransition, removeTransition,
  } = useKeyframesStore();

  const [selectedProp, setSelectedProp] = useState<AnimatableProperty>('opacity');

  const activeObj = selectedObjects[0] as any;
  const objectId: string | undefined = activeObj?.__id;
  const isVideo = activeObj?.__isVideo === true;
  const videoClipId: string | undefined = activeObj?.__videoClipId;
  const videoClip = videoClipId ? clips.find((c) => c.id === videoClipId) : undefined;

  // ── No selection ──────────────────────────────────────────────────────────
  if (!objectId) return <EmptyState reason="no-selection" />;

  // ── Keyframes for this object ──────────────────────────────────────────────
  const objKeyframes = keyframes.filter((k) => k.objectId === objectId);

  // Group by property
  const byProp = new Map<AnimatableProperty, typeof objKeyframes>();
  objKeyframes.forEach((kf) => {
    if (!byProp.has(kf.property)) byProp.set(kf.property, []);
    byProp.get(kf.property)!.push(kf);
  });
  const animatedProps = Array.from(byProp.keys());

  // ── Add keyframe at current playhead ──────────────────────────────────────
  const handleAddKeyframe = () => {
    const raw = (activeObj as any)?.[selectedProp];
    const value = typeof raw === 'number' ? raw : 0;
    addKeyframe({ objectId, property: selectedProp, time: playhead, value, easing: 'ease-in-out' });
  };

  // ── Transitions for this clip ──────────────────────────────────────────────
  const clipTransitions = videoClipId
    ? transitions.filter((t) => t.clipId === videoClipId)
    : [];
  const inTransition  = clipTransitions.find((t) => t.position === 'in');
  const outTransition = clipTransitions.find((t) => t.position === 'out');

  return (
    <div
      className="flex flex-col gap-4 p-3 overflow-y-auto"
      style={{ height: '100%' }}
    >
      {/* ── Header info ──────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '8px 10px', borderRadius: 8,
          background: '#1a2236', border: '1px solid #21283a',
          fontSize: 10, color: '#6b7280',
        }}
      >
        <span style={{ color: '#818cf8' }}>⏱ {fmt(playhead)}</span>
        {' '}— Playhead position · {objKeyframes.length} keyframe{objKeyframes.length !== 1 ? 's' : ''}
      </div>

      {/* ── Add keyframe ─────────────────────────────────────────────────── */}
      <Section title="Add keyframe at playhead">
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={selectedProp}
            onChange={(e) => setSelectedProp(e.target.value as AnimatableProperty)}
            style={{
              flex: 1, padding: '5px 8px', borderRadius: 6,
              background: '#1e2535', border: '1px solid #2d3748',
              color: '#d1d5db', fontSize: 11, cursor: 'pointer',
            }}
          >
            {ANIMATABLE_PROPERTIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <button
            onClick={handleAddKeyframe}
            title={`Add ${selectedProp} keyframe at ${fmt(playhead)}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 6,
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#818cf8', fontSize: 11, cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.25)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.15)'; }}
          >
            <Plus size={12} />
            Add
          </button>
        </div>
      </Section>

      {/* ── Keyframe list by property ─────────────────────────────────────── */}
      {animatedProps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 11, color: '#374151' }}>
          No keyframes yet. Add one above.
        </div>
      ) : (
        <Section title="Keyframes">
          {animatedProps.map((prop) => {
            const kfs = (byProp.get(prop) ?? []).slice().sort((a, b) => a.time - b.time);
            return (
              <div key={prop} style={{ marginBottom: 10 }}>
                {/* Property header */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: PROP_COLORS[prop],
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 10, color: '#9ca3af', flex: 1 }}>
                    {ANIMATABLE_PROPERTIES.find((p) => p.value === prop)?.label ?? prop}
                  </span>
                  <button
                    onClick={() => {
                      kfs.forEach((kf) => removeKeyframe(kf.id));
                    }}
                    title="Remove all keyframes for this property"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#374151', padding: 2,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#374151'; }}
                  >
                    <Trash2 size={9} />
                  </button>
                </div>
                {kfs.map((kf) => (
                  <KfRow
                    key={kf.id}
                    time={kf.time}
                    value={kf.value}
                    easing={kf.easing}
                    property={kf.property}
                    onDelete={() => removeKeyframe(kf.id)}
                    onEasingChange={(e) => updateKeyframe(kf.id, { easing: e })}
                  />
                ))}
              </div>
            );
          })}
        </Section>
      )}

      {/* ── Transitions (video clips only) ───────────────────────────────── */}
      {isVideo && videoClip && (
        <>
          <div style={{ height: 1, background: '#21283a' }} />
          <Section title="Clip transitions">
            {/* In transition */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 6 }}>
                <Film size={9} style={{ display: 'inline', marginRight: 4 }} />
                Fade In
              </div>
              {inTransition ? (
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 8px', borderRadius: 6,
                    background: '#1a2236', border: '1px solid #21283a',
                  }}
                >
                  <span style={{ fontSize: 10, color: '#d1d5db', flex: 1 }}>
                    {TRANSITION_DEFS.find((d) => d.type === inTransition.type)?.label ?? inTransition.type}
                    {' · '}{inTransition.duration.toFixed(1)}s
                  </span>
                  <button
                    onClick={() => removeTransition(inTransition.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: 2 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#374151'; }}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ) : (
                <TransitionPicker
                  clipId={videoClip.id}
                  position="in"
                  maxDuration={(videoClip.trimEnd - videoClip.trimStart) / 2}
                />
              )}
            </div>

            {/* Out transition */}
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 6 }}>
                <Film size={9} style={{ display: 'inline', marginRight: 4 }} />
                Fade Out
              </div>
              {outTransition ? (
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 8px', borderRadius: 6,
                    background: '#1a2236', border: '1px solid #21283a',
                  }}
                >
                  <span style={{ fontSize: 10, color: '#d1d5db', flex: 1 }}>
                    {TRANSITION_DEFS.find((d) => d.type === outTransition.type)?.label ?? outTransition.type}
                    {' · '}{outTransition.duration.toFixed(1)}s
                  </span>
                  <button
                    onClick={() => removeTransition(outTransition.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: 2 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#374151'; }}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ) : (
                <TransitionPicker
                  clipId={videoClip.id}
                  position="out"
                  maxDuration={(videoClip.trimEnd - videoClip.trimStart) / 2}
                />
              )}
            </div>
          </Section>
        </>
      )}

      {/* ── Docs note ─────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '8px 10px', borderRadius: 6,
          background: 'rgba(99,102,241,0.05)',
          border: '1px solid rgba(99,102,241,0.1)',
          fontSize: 9, color: '#374151', lineHeight: 1.6,
        }}
      >
        Keyframes animate property values over time. Values between keyframes
        are interpolated using the chosen easing curve. The Timeline playhead
        determines the current time.
      </div>
    </div>
  );
}

// ─── Transition picker ────────────────────────────────────────────────────────

function TransitionPicker({
  clipId, position, maxDuration,
}: {
  clipId: string;
  position: 'in' | 'out';
  maxDuration: number;
}) {
  const { addTransition } = useKeyframesStore();
  const [duration, setDuration] = useState(0.4);
  const [open, setOpen] = useState(false);

  const handlePick = (type: TransitionType) => {
    addTransition({ clipId, type, position, duration });
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          gap: 4, padding: '5px 8px', borderRadius: 6,
          background: '#1a2236', border: '1px dashed #2d3748',
          color: '#4b5563', fontSize: 10, cursor: 'pointer',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#6366f1'; (e.currentTarget as HTMLElement).style.color = '#818cf8'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#2d3748'; (e.currentTarget as HTMLElement).style.color = '#4b5563'; }}
      >
        <Plus size={10} />
        Add {position === 'in' ? 'fade-in' : 'fade-out'} transition
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
              background: '#1e2535', border: '1px solid #2d3748',
              borderRadius: 8, padding: 10,
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              marginTop: 4,
            }}
          >
            {/* Duration slider */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: '#6b7280' }}>Duration</span>
                <span style={{ fontSize: 9, color: '#9ca3af' }}>{duration.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={0.1} max={Math.min(maxDuration, 2)} step={0.1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#6366f1' }}
              />
            </div>

            {/* Transition grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {TRANSITION_DEFS.map((def) => (
                <button
                  key={def.type}
                  onClick={() => handlePick(def.type)}
                  title={def.label}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '6px 4px', borderRadius: 6, cursor: 'pointer',
                    background: '#0b0f1a', border: '1px solid #1f2937',
                    color: '#6b7280', fontSize: 8, gap: 2,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#6366f1';
                    (e.currentTarget as HTMLElement).style.color = '#818cf8';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#1f2937';
                    (e.currentTarget as HTMLElement).style.color = '#6b7280';
                  }}
                >
                  <span style={{ fontSize: 14 }}>{def.icon}</span>
                  <span>{def.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
