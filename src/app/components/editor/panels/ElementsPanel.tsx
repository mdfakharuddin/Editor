import { useState } from 'react';
import { useEditorStore } from '../../../store/editorStore';
import { Search, Square, Circle, Minus, Triangle, Star, Hexagon } from 'lucide-react';

interface ElementsPanelProps {
  onAddShape: (type: 'rect' | 'circle' | 'line' | 'text') => void;
}

const BASIC_SHAPES = [
  { type: 'rect' as const, icon: Square, label: 'Rectangle', shortcut: 'R' },
  { type: 'circle' as const, icon: Circle, label: 'Circle', shortcut: 'C' },
  { type: 'line' as const, icon: Minus, label: 'Line', shortcut: 'L' },
  { type: 'rect' as const, icon: Triangle, label: 'Triangle', shortcut: null },
  { type: 'rect' as const, icon: Star, label: 'Star', shortcut: null },
  { type: 'circle' as const, icon: Hexagon, label: 'Hexagon', shortcut: null },
];

const FRAME_SIZES = [
  { label: 'Instagram Post', w: 1080, h: 1080, color: '#e879f9' },
  { label: 'Story (9:16)', w: 1080, h: 1920, color: '#f97316' },
  { label: 'Presentation', w: 1920, h: 1080, color: '#6366f1' },
  { label: 'A4 Document', w: 794, h: 1123, color: '#22c55e' },
  { label: 'Twitter Banner', w: 1500, h: 500, color: '#06b6d4' },
  { label: 'YouTube Thumb', w: 1280, h: 720, color: '#ef4444' },
];

const LINE_STYLES = [
  { label: 'Straight', preview: '—————————' },
  { label: 'Dashed', preview: '– – – – – –' },
  { label: 'Dotted', preview: '· · · · · ·' },
];

const PALETTE: { color: string; name: string }[] = [
  { color: '#ef4444', name: 'Red' },
  { color: '#f97316', name: 'Orange' },
  { color: '#eab308', name: 'Yellow' },
  { color: '#22c55e', name: 'Green' },
  { color: '#06b6d4', name: 'Cyan' },
  { color: '#6366f1', name: 'Indigo' },
  { color: '#8b5cf6', name: 'Purple' },
  { color: '#ec4899', name: 'Pink' },
  { color: '#f8fafc', name: 'White' },
  { color: '#94a3b8', name: 'Slate' },
  { color: '#475569', name: 'Dark Slate' },
  { color: '#0f172a', name: 'Dark' },
];

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-4 pb-2 shrink-0">
      <span className="text-xs" style={{ color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </span>
    </div>
  );
}

export function ElementsPanel({ onAddShape }: ElementsPanelProps) {
  const [search, setSearch] = useState('');
  const { canvas, selectedObjects } = useEditorStore();
  const hasSelection = selectedObjects.length > 0;

  const applyColorToSelected = (color: string) => {
    if (!canvas) return;
    const obj = canvas.getActiveObject() as any;
    if (!obj) return;
    obj.set('fill', color);
    canvas.requestRenderAll();
    setTimeout(() => {
      const json = JSON.stringify(canvas.toJSON(['__id', '__name', '__isArtboard']));
      useEditorStore.getState().pushHistory(json);
    }, 30);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 shrink-0">
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: '#1e2535', border: '1px solid #2d3748' }}
        >
          <Search size={13} style={{ color: '#6b7280', flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search elements…"
            className="flex-1 bg-transparent outline-none text-xs placeholder:text-gray-600"
            style={{ color: '#d1d5db' }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Shapes */}
        <SectionHeader>Shapes</SectionHeader>
        <div className="grid grid-cols-3 gap-1.5 px-3">
          {BASIC_SHAPES.map((shape, i) => {
            const Icon = shape.icon;
            return (
              <button
                key={i}
                onClick={() => onAddShape(shape.type)}
                className="flex flex-col items-center justify-center gap-2 py-3 rounded-xl transition-all"
                style={{ background: '#1e2535', border: '1px solid #2d3748' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#6366f1';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.1)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#2d3748';
                  (e.currentTarget as HTMLElement).style.background = '#1e2535';
                }}
                title={`Add ${shape.label}${shape.shortcut ? ` (${shape.shortcut})` : ''}`}
              >
                <Icon size={20} style={{ color: '#818cf8' }} />
                <span style={{ fontSize: 10, color: '#9ca3af' }}>{shape.label}</span>
              </button>
            );
          })}
        </div>

        {/* Lines */}
        <SectionHeader>Lines & Connectors</SectionHeader>
        <div className="flex flex-col gap-1.5 px-3">
          {LINE_STYLES.map((ls) => (
            <button
              key={ls.label}
              onClick={() => onAddShape('line')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
              style={{ background: '#1e2535', border: '1px solid #2d3748' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#6366f1';
                (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#2d3748';
                (e.currentTarget as HTMLElement).style.background = '#1e2535';
              }}
            >
              <span className="text-xs font-mono" style={{ color: '#818cf8', letterSpacing: 1 }}>{ls.preview}</span>
              <span className="ml-auto text-xs" style={{ color: '#6b7280' }}>{ls.label}</span>
            </button>
          ))}
        </div>

        {/* Frames */}
        <SectionHeader>Canvas Frames</SectionHeader>
        <div className="flex flex-col gap-1.5 px-3">
          {FRAME_SIZES.map((frame) => (
            <button
              key={frame.label}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('editor:resizeArtboard', {
                    detail: { width: frame.w, height: frame.h },
                  })
                );
              }}
              className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all"
              style={{ background: '#1e2535', border: '1px solid #2d3748' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = frame.color;
                (e.currentTarget as HTMLElement).style.background = `${frame.color}12`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#2d3748';
                (e.currentTarget as HTMLElement).style.background = '#1e2535';
              }}
            >
              <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: frame.color, opacity: 0.8 }} />
              <span className="text-xs flex-1 text-left" style={{ color: '#9ca3af' }}>{frame.label}</span>
              <span style={{ color: '#374151', fontSize: 10 }}>{frame.w}×{frame.h}</span>
            </button>
          ))}
        </div>

        {/* Quick Colors */}
        <SectionHeader>Quick Colors</SectionHeader>
        <div className="px-3 pb-4">
          {hasSelection && (
            <p className="text-xs mb-2" style={{ color: '#4b5563' }}>
              Click to apply fill to selected object
            </p>
          )}
          {!hasSelection && (
            <p className="text-xs mb-2" style={{ color: '#374151' }}>
              Select an object to apply colors
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {PALETTE.map(({ color, name }) => (
              <button
                key={color}
                title={hasSelection ? `Apply ${name} fill` : name}
                onClick={() => hasSelection && applyColorToSelected(color)}
                className="w-7 h-7 rounded-lg transition-all"
                style={{
                  background: color,
                  border: '2px solid transparent',
                  cursor: hasSelection ? 'pointer' : 'default',
                  opacity: hasSelection ? 1 : 0.5,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
                onMouseEnter={(e) => {
                  if (hasSelection)
                    (e.currentTarget as HTMLElement).style.border = '2px solid white';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.border = '2px solid transparent';
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
