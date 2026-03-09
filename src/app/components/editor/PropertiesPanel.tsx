import { useEffect, useState, useCallback } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { useArtboardStore } from '../../store/artboardStore';
import { useTextStylesStore, applyTextStyleToFabric } from '../../store/textStylesStore';
import { useVideoStore, videoElementsMap } from '../../store/videoStore';
import { AlignPanel } from './AlignPanel';
import {
  SlidersHorizontal, AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  Underline, Link2, RotateCcw, PenTool, ChevronDown, Film, Volume2, VolumeX,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ObjProps {
  left: number;
  top: number;
  width: number;
  height: number;
  angle: number;
  opacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  rx: number;
  // Text
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
  textAlign: string;
  lineHeight: number;
  letterSpacing: number;
  // Line
  x1?: number; y1?: number; x2?: number; y2?: number;
}

const DEFAULT_PROPS: ObjProps = {
  left: 0, top: 0, width: 0, height: 0, angle: 0, opacity: 100,
  fill: '#6366f1', stroke: '', strokeWidth: 0, rx: 0,
  fontSize: 24, fontFamily: 'Arial', fontWeight: 'normal',
  fontStyle: 'normal', textDecoration: '', textAlign: 'left',
  lineHeight: 1.2, letterSpacing: 0,
};

const FONT_FAMILIES = [
  'Inter', 'Arial', 'Georgia', 'Times New Roman',
  'Courier New', 'Verdana', 'Trebuchet MS', 'Impact',
  'Playfair Display', 'Roboto', 'Open Sans', 'Lato',
];

function extractProps(obj: any): ObjProps {
  const w = obj.type === 'ellipse'
    ? (obj.rx || 0) * 2 * (obj.scaleX || 1)
    : obj.type === 'line'
      ? Math.abs((obj.x2 || 0) - (obj.x1 || 0)) * (obj.scaleX || 1)
      : (obj.width || 0) * (obj.scaleX || 1);
  const h = obj.type === 'ellipse'
    ? (obj.ry || 0) * 2 * (obj.scaleY || 1)
    : obj.type === 'line'
      ? Math.abs((obj.y2 || 0) - (obj.y1 || 0)) * (obj.scaleY || 1)
      : (obj.height || 0) * (obj.scaleY || 1);

  return {
    left: Math.round(obj.left || 0),
    top: Math.round(obj.top || 0),
    width: Math.round(w),
    height: Math.round(h),
    angle: Math.round(obj.angle || 0),
    opacity: Math.round((obj.opacity ?? 1) * 100),
    fill: colorToHex(obj.fill) || '#000000',
    stroke: colorToHex(obj.stroke) || '',
    strokeWidth: obj.strokeWidth || 0,
    rx: obj.rx || 0,
    fontSize: obj.fontSize || 24,
    fontFamily: obj.fontFamily || 'Arial',
    fontWeight: obj.fontWeight || 'normal',
    fontStyle: obj.fontStyle || 'normal',
    textDecoration: obj.underline ? 'underline' : '',
    textAlign: obj.textAlign || 'left',
    lineHeight: obj.lineHeight || 1.2,
    letterSpacing: obj.charSpacing ? obj.charSpacing / 100 : 0,
    x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2,
  };
}

function colorToHex(c: any): string {
  if (!c || c === 'transparent' || c === '') return '';
  if (typeof c === 'string' && c.startsWith('#')) return c;
  return c;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function PropertiesPanel() {
  const { selectedObjects, canvas } = useEditorStore();
  const { getActivePage, updatePageBackground, updatePageSize, activePageId } = useArtboardStore();
  const { getAllPresets } = useTextStylesStore();
  const [props, setProps] = useState<ObjProps>(DEFAULT_PROPS);
  const [objType, setObjType] = useState<string>('');
  const [lockAspect, setLockAspect] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);

  const activeObj = selectedObjects[0] as any;
  const isVideo = activeObj?.__isVideo === true;
  const videoClip = isVideo
    ? useVideoStore.getState().clips.find((c) => c.id === activeObj.__videoClipId)
    : null;

  // Sync from selected object
  useEffect(() => {
    if (!activeObj) { setObjType(''); return; }
    setProps(extractProps(activeObj));
    setObjType(activeObj.type || '');
  }, [activeObj, selectedObjects]);

  // Apply prop change to fabric object
  const apply = useCallback((key: string, value: any) => {
    if (!activeObj || !canvas) return;

    if (key === 'width') {
      if (activeObj.type === 'ellipse') {
        if (lockAspect) {
          const ratio = (activeObj.ry || 1) / (activeObj.rx || 1);
          activeObj.set('ry', (value / 2) * ratio);
        }
        activeObj.set('rx', value / 2 / (activeObj.scaleX || 1));
      } else if (activeObj.type === 'line') {
        activeObj.set('x2', (activeObj.x1 || 0) + value);
      } else {
        if (lockAspect) {
          const ratio = (activeObj.height || 1) / (activeObj.width || 1);
          activeObj.set('scaleY', (value * ratio) / (activeObj.height || 1));
        }
        activeObj.set('scaleX', value / (activeObj.width || 1));
      }
    } else if (key === 'height') {
      if (activeObj.type === 'ellipse') {
        if (lockAspect) {
          const ratio = (activeObj.rx || 1) / (activeObj.ry || 1);
          activeObj.set('rx', (value / 2) * ratio);
        }
        activeObj.set('ry', value / 2 / (activeObj.scaleY || 1));
      } else if (activeObj.type === 'line') {
        activeObj.set('y2', (activeObj.y1 || 0) + value);
      } else {
        if (lockAspect) {
          const ratio = (activeObj.width || 1) / (activeObj.height || 1);
          activeObj.set('scaleX', (value * ratio) / (activeObj.width || 1));
        }
        activeObj.set('scaleY', value / (activeObj.height || 1));
      }
    } else if (key === 'opacity') {
      activeObj.set('opacity', value / 100);
    } else if (key === 'rx') {
      activeObj.set('rx', value);
      activeObj.set('ry', value);
    } else if (key === 'letterSpacing') {
      activeObj.set('charSpacing', value * 100);
    } else if (key === 'textDecoration') {
      activeObj.set('underline', value === 'underline');
    } else {
      activeObj.set(key as any, value);
    }

    canvas.requestRenderAll();
    setProps((prev) => ({ ...prev, [key]: value }));
  }, [activeObj, canvas, lockAspect]);

  const commitHistory = useCallback(() => {
    if (!canvas) return;
    setTimeout(() => {
      const json = JSON.stringify(canvas.toJSON(['__id', '__name', '__isArtboard']));
      useEditorStore.getState().pushHistory(json);
    }, 20);
  }, [canvas]);

  if (!activeObj || selectedObjects.length === 0) {
    // Show artboard / page properties when nothing is selected
    const activePage = getActivePage();
    return (
      <div className="flex flex-col h-full overflow-y-auto" style={{ minHeight: 0 }}>
        {/* Header */}
        <div
          className="flex items-center gap-1.5 px-3 py-2.5 shrink-0"
          style={{ borderBottom: '1px solid #21283a' }}
        >
          <SlidersHorizontal size={13} style={{ color: '#6366f1' }} />
          <span className="text-xs" style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Page
          </span>
          {activePage && (
            <span className="ml-auto text-xs" style={{ color: '#4b5563' }}>
              {activePage.name}
            </span>
          )}
        </div>

        {activePage && (
          <div className="p-3 flex flex-col gap-4">
            {/* Page size */}
            <div className="flex flex-col gap-2">
              <span className="text-xs" style={{ color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Artboard Size
              </span>
              <div className="grid grid-cols-2 gap-2">
                <NumberInput
                  label="Width"
                  value={activePage.width}
                  onChange={(v) => updatePageSize(activePageId, v, activePage.height)}
                />
                <NumberInput
                  label="Height"
                  value={activePage.height}
                  onChange={(v) => updatePageSize(activePageId, activePage.width, v)}
                />
              </div>
            </div>

            {/* Page background */}
            <div className="flex flex-col gap-2">
              <span className="text-xs" style={{ color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Background
              </span>
              <ColorRow
                value={activePage.backgroundColor}
                onChange={(v) => updatePageBackground(activePageId, v)}
              />
            </div>

            {/* Keyboard hints */}
            <div style={{ height: 1, width: '100%', background: '#21283a' }} />
            <div className="flex flex-col gap-1.5">
              {[
                ['V', 'Select tool'],
                ['H', 'Pan / hand tool'],
                ['R', 'Rectangle'],
                ['C', 'Ellipse'],
                ['L', 'Line'],
                ['T', 'Text'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-6">
                  <kbd
                    className="px-1.5 py-0.5 rounded text-xs"
                    style={{ background: '#1e2535', color: '#6366f1', border: '1px solid #2d3748' }}
                  >
                    {key}
                  </kbd>
                  <span className="text-xs" style={{ color: '#374151' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Video object selected ──────────────────────────────────────────────────
  if (isVideo && videoClip) {
    const { updateClip } = useVideoStore.getState();
    const el = videoElementsMap.get(videoClip.id);
    return (
      <div className="flex flex-col h-full overflow-y-auto" style={{ minHeight: 0 }}>
        <SectionHeader icon={<Film size={12} style={{ color: '#6366f1' }} />} title="Video" />
        <div className="p-3 flex flex-col gap-4">
          {/* Thumbnail */}
          {videoClip.thumbnail && (
            <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #2d3748' }}>
              <img src={videoClip.thumbnail} alt={videoClip.name} style={{ width: '100%', display: 'block' }} />
            </div>
          )}

          {/* Name & duration */}
          <div className="flex flex-col gap-1">
            <span style={{ fontSize: 11, color: '#d1d5db', fontWeight: 500 }}>{videoClip.name}</span>
            <span style={{ fontSize: 10, color: '#4b5563' }}>
              {videoClip.width}×{videoClip.height} · {Math.round(videoClip.duration * 10) / 10}s
            </span>
          </div>

          <div style={{ height: 1, background: '#21283a' }} />

          {/* Position & size — same as normal object */}
          <Section title="Transform">
            <div className="grid grid-cols-2 gap-2">
              <NumberInput label="X" value={props.left} onChange={(v) => apply('left', v)} onBlur={commitHistory} />
              <NumberInput label="Y" value={props.top} onChange={(v) => apply('top', v)} onBlur={commitHistory} />
              <NumberInput label="W" value={props.width} onChange={(v) => apply('width', v)} onBlur={commitHistory} />
              <NumberInput label="H" value={props.height} onChange={(v) => apply('height', v)} onBlur={commitHistory} />
            </div>
          </Section>

          <div style={{ height: 1, background: '#21283a' }} />

          {/* Volume */}
          <Section title="Audio">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (el) el.muted = !videoClip.muted;
                    updateClip(videoClip.id, { muted: !videoClip.muted });
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
                  style={{
                    background: videoClip.muted ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
                    border: `1px solid ${videoClip.muted ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)'}`,
                    color: videoClip.muted ? '#f87171' : '#818cf8',
                  }}
                >
                  {videoClip.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                  {videoClip.muted ? 'Muted' : 'Audio on'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 10, color: '#6b7280', minWidth: 40 }}>Volume</span>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={videoClip.volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (el) el.volume = v;
                    updateClip(videoClip.id, { volume: v });
                  }}
                  style={{ flex: 1, accentColor: '#6366f1' }}
                />
                <span style={{ fontSize: 10, color: '#4b5563', minWidth: 28, textAlign: 'right' }}>
                  {Math.round(videoClip.volume * 100)}%
                </span>
              </div>
            </div>
          </Section>

          <div style={{ height: 1, background: '#21283a' }} />

          {/* Trim info */}
          <Section title="Trim">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 10, color: '#6b7280' }}>In point</span>
                <span style={{ fontSize: 10, color: '#d1d5db' }}>{videoClip.trimStart.toFixed(2)}s</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 10, color: '#6b7280' }}>Out point</span>
                <span style={{ fontSize: 10, color: '#d1d5db' }}>{videoClip.trimEnd.toFixed(2)}s</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 10, color: '#6b7280' }}>Duration</span>
                <span style={{ fontSize: 10, color: '#818cf8' }}>
                  {(videoClip.trimEnd - videoClip.trimStart).toFixed(2)}s
                </span>
              </div>
              <p style={{ fontSize: 9, color: '#374151', marginTop: 2, lineHeight: 1.5 }}>
                Trim by dragging clip edges in the Timeline.
              </p>
            </div>
          </Section>

          <div style={{ height: 1, background: '#21283a' }} />

          <AlignPanel />
        </div>
      </div>
    );
  }

  const isText = objType === 'i-text' || objType === 'text';
  const isLine = objType === 'line';
  const isRect = objType === 'rect';
  const isMulti = selectedObjects.length > 1;

  return (
    <div className="flex flex-col gap-0 overflow-y-auto h-full" style={{ minHeight: 0 }}>
      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-3 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid #21283a' }}
      >
        <SlidersHorizontal size={13} style={{ color: '#6366f1' }} />
        <span className="text-xs" style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Properties
        </span>
        <span className="ml-auto text-xs capitalize" style={{ color: '#4b5563' }}>
          {isMulti ? `${selectedObjects.length} objects` : objType}
        </span>
      </div>

      <div className="p-3 flex flex-col gap-4">
        {/* ── Transform ─────────────────────────────────────── */}
        {!isMulti && (
          <Section title="Transform">
            <div className="grid grid-cols-2 gap-2">
              <NumberInput label="X" value={props.left}
                onChange={(v) => apply('left', v)} onBlur={commitHistory} />
              <NumberInput label="Y" value={props.top}
                onChange={(v) => apply('top', v)} onBlur={commitHistory} />
              {!isLine && (
                <>
                  {/* Width & Height with aspect lock */}
                  <div className="relative">
                    <NumberInput label="W" value={props.width}
                      onChange={(v) => apply('width', v)} onBlur={commitHistory} />
                  </div>
                  <div className="relative">
                    <NumberInput label="H" value={props.height}
                      onChange={(v) => apply('height', v)} onBlur={commitHistory} />
                  </div>
                </>
              )}
              <NumberInput label="°" value={props.angle}
                onChange={(v) => apply('angle', v)} onBlur={commitHistory} />
              <div className="flex flex-col gap-1">
                <LabelTxt>Opacity %</LabelTxt>
                <div className="flex items-center gap-1.5">
                  <input
                    type="range"
                    min={0} max={100}
                    value={props.opacity}
                    onChange={(e) => apply('opacity', Number(e.target.value))}
                    onMouseUp={commitHistory}
                    className="flex-1"
                    style={{ accentColor: '#6366f1' }}
                  />
                  <span className="text-xs w-7 text-right" style={{ color: '#9ca3af' }}>
                    {props.opacity}
                  </span>
                </div>
              </div>
            </div>
            {isRect && (
              <NumberInput label="Corner Radius" value={props.rx} min={0}
                onChange={(v) => apply('rx', v)} onBlur={commitHistory} />
            )}
            {/* Aspect lock for non-line */}
            {!isLine && (
              <button
                onClick={() => setLockAspect((p) => !p)}
                className="flex items-center gap-1.5 text-xs transition-colors mt-0.5"
                style={{ color: lockAspect ? '#6366f1' : '#4b5563' }}
              >
                <Link2 size={11} />
                {lockAspect ? 'Aspect locked' : 'Lock aspect ratio'}
              </button>
            )}
          </Section>
        )}

        {/* ── Fill ──────────────────────────────────────────── */}
        {!isLine && !isMulti && (
          <Section title="Fill">
            <ColorRow
              value={props.fill}
              onChange={(v) => { apply('fill', v); commitHistory(); }}
            />
          </Section>
        )}

        {/* ── Stroke ────────────────────────────────────────── */}
        {!isMulti && (
          <Section title="Stroke">
            <ColorRow
              value={props.stroke}
              onChange={(v) => { apply('stroke', v); commitHistory(); }}
            />
            <NumberInput label="Stroke Width" value={props.strokeWidth} min={0}
              onChange={(v) => apply('strokeWidth', v)} onBlur={commitHistory} />
          </Section>
        )}

        {/* ── Typography ────────────────────────────────────── */}
        {isText && (
          <Section title="Typography">
            {/* Quick style picker */}
            <div className="relative">
              <button
                onClick={() => setShowStylePicker((v) => !v)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  background: showStylePicker ? 'rgba(99,102,241,0.15)' : '#1e2535',
                  border: `1px solid ${showStylePicker ? '#6366f1' : '#2d3748'}`,
                  color: '#9ca3af',
                }}
              >
                <PenTool size={11} style={{ color: '#6366f1' }} />
                <span className="flex-1 text-left">Apply text style…</span>
                <ChevronDown size={10} />
              </button>
              {showStylePicker && (
                <div
                  className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg overflow-hidden overflow-y-auto"
                  style={{
                    maxHeight: 220,
                    background: '#1a2030',
                    border: '1px solid #2d3748',
                    boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
                  }}
                >
                  {getAllPresets().map((preset) => (
                    <button
                      key={preset.id}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors"
                      style={{ background: 'transparent', color: '#c9d1d9' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.12)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                      onClick={() => {
                        applyTextStyleToFabric(activeObj, preset, canvas);
                        setProps(extractProps(activeObj));
                        commitHistory();
                        setShowStylePicker(false);
                      }}
                    >
                      <span
                        style={{
                          fontFamily: preset.character.fontFamily,
                          fontSize: Math.min((preset.character.fontSize ?? 16) * 0.55, 16),
                          fontWeight: preset.character.fontWeight,
                          fontStyle: preset.character.fontStyle,
                          color: '#d1d5db',
                          flexShrink: 0,
                          lineHeight: 1,
                        }}
                      >
                        Aa
                      </span>
                      <div className="flex flex-col gap-0">
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{preset.name}</span>
                        <span style={{ fontSize: 9, color: '#374151' }}>
                          {preset.character.fontFamily} · {preset.character.fontSize}px
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Font family */}
            <div className="flex flex-col gap-1">
              <LabelTxt>Font</LabelTxt>
              <select
                value={props.fontFamily}
                onChange={(e) => { apply('fontFamily', e.target.value); commitHistory(); }}
                className="w-full rounded px-2 py-1.5 text-xs outline-none"
                style={{ background: '#1e2535', border: '1px solid #2d3748', color: '#d1d5db' }}
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <NumberInput label="Size" value={props.fontSize} min={4}
                onChange={(v) => apply('fontSize', v)} onBlur={commitHistory} />
              <NumberInput label="Line Height" value={+props.lineHeight.toFixed(2)} min={0.5} max={5} step={0.1}
                onChange={(v) => apply('lineHeight', v)} onBlur={commitHistory} />
            </div>

            <NumberInput label="Letter Spacing" value={props.letterSpacing} min={-20} max={100} step={0.5}
              onChange={(v) => apply('letterSpacing', v)} onBlur={commitHistory} />

            {/* Text align */}
            <div className="flex flex-col gap-1">
              <LabelTxt>Align</LabelTxt>
              <div className="flex gap-1">
                {[
                  { v: 'left', icon: <AlignLeft size={12} /> },
                  { v: 'center', icon: <AlignCenter size={12} /> },
                  { v: 'right', icon: <AlignRight size={12} /> },
                ].map(({ v, icon }) => (
                  <button
                    key={v}
                    onClick={() => { apply('textAlign', v); commitHistory(); }}
                    className="flex-1 flex items-center justify-center py-1.5 rounded transition-colors"
                    style={{
                      background: props.textAlign === v ? '#6366f1' : '#1e2535',
                      border: '1px solid #2d3748',
                      color: props.textAlign === v ? '#fff' : '#9ca3af',
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Style toggles */}
            <div className="flex gap-1.5">
              <ToggleBtn
                active={props.fontWeight === 'bold'}
                onClick={() => {
                  apply('fontWeight', props.fontWeight === 'bold' ? 'normal' : 'bold');
                  commitHistory();
                }}
                title="Bold"
              >
                <Bold size={12} />
              </ToggleBtn>
              <ToggleBtn
                active={props.fontStyle === 'italic'}
                onClick={() => {
                  apply('fontStyle', props.fontStyle === 'italic' ? 'normal' : 'italic');
                  commitHistory();
                }}
                title="Italic"
              >
                <Italic size={12} />
              </ToggleBtn>
              <ToggleBtn
                active={props.textDecoration === 'underline'}
                onClick={() => {
                  apply('textDecoration', props.textDecoration === 'underline' ? '' : 'underline');
                  commitHistory();
                }}
                title="Underline"
              >
                <Underline size={12} />
              </ToggleBtn>
            </div>
          </Section>
        )}

        {/* ── Align & Arrange ───────────────────────────────── */}
        <AlignPanel />

        {/* ── Reset ─────────────────────────────────────────── */}
        {!isMulti && (
          <button
            onClick={() => {
              if (!canvas || !activeObj) return;
              activeObj.set({ angle: 0, scaleX: 1, scaleY: 1, opacity: 1 });
              canvas.requestRenderAll();
              setProps(extractProps(activeObj));
              commitHistory();
            }}
            className="flex items-center gap-1.5 w-full justify-center py-1.5 rounded text-xs transition-colors mt-1"
            style={{
              background: '#1e2535',
              border: '1px solid #2d3748',
              color: '#6b7280',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = '#e2e8f0';
              (e.currentTarget as HTMLElement).style.borderColor = '#374151';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = '#6b7280';
              (e.currentTarget as HTMLElement).style.borderColor = '#2d3748';
            }}
          >
            <RotateCcw size={11} /> Reset Transform
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs" style={{ color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </span>
      {children}
    </div>
  );
}

function LabelTxt({ children }: { children: React.ReactNode }) {
  return <span className="text-xs" style={{ color: '#6b7280' }}>{children}</span>;
}

function NumberInput({
  label, value, onChange, onBlur, min, max, step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onBlur?: () => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [localVal, setLocalVal] = useState(String(value));

  useEffect(() => {
    setLocalVal(String(Math.round(value * 100) / 100));
  }, [value]);

  return (
    <div className="flex flex-col gap-1">
      <LabelTxt>{label}</LabelTxt>
      <input
        type="number"
        value={localVal}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => {
          setLocalVal(e.target.value);
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
        onBlur={() => {
          const n = parseFloat(localVal);
          if (!isNaN(n)) onChange(n);
          onBlur?.();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-full rounded px-2 py-1.5 text-xs outline-none"
        style={{ background: '#1e2535', border: '1px solid #2d3748', color: '#d1d5db' }}
      />
    </div>
  );
}

function ColorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const safeValue = value && value.startsWith('#') ? value : '#000000';
  const isEmpty = !value;

  return (
    <div className="flex items-center gap-2">
      <label
        className="w-8 h-8 rounded-lg cursor-pointer shrink-0 flex items-center justify-center overflow-hidden relative"
        style={{
          border: '2px solid #374151',
          backgroundColor: isEmpty ? 'transparent' : safeValue,
          backgroundImage: isEmpty
            ? 'repeating-linear-gradient(45deg, #374151 0, #374151 2px, transparent 0, transparent 50%)'
            : 'none',
          backgroundSize: isEmpty ? '6px 6px' : 'auto',
        }}
      >
        <input
          type="color"
          value={safeValue}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        />
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="None"
        className="flex-1 rounded px-2 py-1.5 text-xs outline-none font-mono"
        style={{ background: '#1e2535', border: '1px solid #2d3748', color: '#d1d5db' }}
      />
    </div>
  );
}

function ToggleBtn({
  active, onClick, children, title,
}: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-8 h-8 rounded transition-all"
      style={{
        background: active ? '#6366f1' : '#1e2535',
        border: '1px solid #2d3748',
        color: active ? '#fff' : '#9ca3af',
      }}
    >
      {children}
    </button>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2.5 shrink-0" style={{ borderBottom: '1px solid #21283a' }}>
      {icon}
      <span className="text-xs" style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {title}
      </span>
    </div>
  );
}