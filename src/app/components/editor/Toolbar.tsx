import { useEditorStore } from '../../store/editorStore';
import type { ToolType } from '../../types/editor';
import { CANVAS_PRESETS } from '../../types/editor';
import {
  MousePointer2, Hand, Square, Circle, Minus, Type,
  Image as ImageIcon, Undo2, Redo2, Download, ChevronDown,
  Layers, Monitor, Zap, Share2, Users, Bell, Settings, Pencil, Film,
} from 'lucide-react';
import { useState, useRef } from 'react';
import { useVideoStore } from '../../store/videoStore';
import { ExportModal } from './ExportModal';

const SELECT_TOOLS: { type: ToolType; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { type: 'select', icon: <MousePointer2 size={15} />, label: 'Select', shortcut: 'V' },
  { type: 'hand', icon: <Hand size={15} />, label: 'Pan', shortcut: 'H' },
];

const SHAPE_TOOLS: { type: ToolType; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { type: 'rect', icon: <Square size={15} />, label: 'Rectangle', shortcut: 'R' },
  { type: 'circle', icon: <Circle size={15} />, label: 'Ellipse', shortcut: 'C' },
  { type: 'line', icon: <Minus size={15} />, label: 'Line', shortcut: 'L' },
  { type: 'text', icon: <Type size={15} />, label: 'Text', shortcut: 'T' },
];

interface ToolbarProps {
  onAddImage?: (file: File) => void;
}

export function Toolbar({ onAddImage }: ToolbarProps) {
  const {
    activeTool, setActiveTool,
    undo, redo, canUndo, canRedo,
    exportAs, setArtboardSize,
    zoom,
  } = useEditorStore();
  const { clips } = useVideoStore();
  const videoFileRef = useRef<HTMLInputElement>(null);

  const [showExportModal, setShowExportModal] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('Untitled Design');
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const handleImageClick = () => fileRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAddImage) onAddImage(file);
    e.target.value = '';
  };

  const handleZoomIn = () => window.dispatchEvent(new CustomEvent('editor:zoomIn'));
  const handleZoomOut = () => window.dispatchEvent(new CustomEvent('editor:zoomOut'));
  const handleFitScreen = () => window.dispatchEvent(new CustomEvent('editor:fitScreen'));
  const handleResetZoom = () => window.dispatchEvent(new CustomEvent('editor:resetZoom'));

  return (
    <>
      <header
        className="flex items-center gap-2 px-3 shrink-0 select-none z-20"
        style={{
          height: 52,
          background: '#161b27',
          borderBottom: '1px solid #21283a',
        }}
      >
        {/* ── Left: Logo + File name ─────────────────────────── */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Layers size={14} color="#fff" />
            </div>
          </div>

          <ToolbarDivider />

          {/* Editable file name */}
          <div className="flex items-center gap-1.5">
            {editingTitle ? (
              <input
                ref={titleRef}
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    setEditingTitle(false);
                  }
                  e.stopPropagation();
                }}
                className="rounded px-2 py-1 text-xs outline-none"
                style={{
                  background: '#1e2535',
                  border: '1px solid #6366f1',
                  color: '#e2e8f0',
                  minWidth: 140,
                  maxWidth: 200,
                }}
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors group"
                style={{ color: '#c9d1d9' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
                title="Click to rename"
              >
                <span className="text-xs">{title}</span>
                <Pencil
                  size={11}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: '#6b7280' }}
                />
              </button>
            )}
          </div>
        </div>

        {/* ── Center: Tool groups ────────────────────────────── */}
        <div className="flex items-center gap-1 flex-1 justify-center">
          {/* Select + Pan */}
          <ToolGroup>
            {SELECT_TOOLS.map((t) => (
              <ToolBtn
                key={t.type}
                active={activeTool === t.type}
                onClick={() => setActiveTool(t.type)}
                title={`${t.label} (${t.shortcut})`}
              >
                {t.icon}
              </ToolBtn>
            ))}
          </ToolGroup>

          <ToolbarDivider />

          {/* Shape tools */}
          <ToolGroup>
            {SHAPE_TOOLS.map((t) => (
              <ToolBtn
                key={t.type}
                active={activeTool === t.type}
                onClick={() => setActiveTool(t.type)}
                title={`${t.label} (${t.shortcut})`}
              >
                {t.icon}
              </ToolBtn>
            ))}
          </ToolGroup>

          <ToolbarDivider />

          {/* Image tool */}
          <ToolBtn
            active={false}
            onClick={handleImageClick}
            title="Add Image"
          >
            <ImageIcon size={15} />
          </ToolBtn>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <ToolbarDivider />

          {/* Video tool */}
          <ToolBtn
            active={false}
            onClick={() => videoFileRef.current?.click()}
            title="Add Video (opens Videos panel)"
          >
            <div style={{ position: 'relative' }}>
              <Film size={15} />
              {clips.length > 0 && (
                <div
                  style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#6366f1',
                  }}
                />
              )}
            </div>
          </ToolBtn>
          <input
            ref={videoFileRef}
            type="file"
            accept="video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.webm,.mov"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              e.target.value = '';
              const { addVideoFile } = await import('../../store/videoStore');
              await addVideoFile(file).catch(console.error);
              window.dispatchEvent(new CustomEvent('editor:showTimeline'));
            }}
          />

          {/* Timeline toggle */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('editor:toggleTimeline'))}
            title="Toggle Video Timeline"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
            style={{
              color: clips.length > 0 ? '#818cf8' : '#4b5563',
              background: clips.length > 0 ? 'rgba(99,102,241,0.1)' : 'transparent',
              border: `1px solid ${clips.length > 0 ? 'rgba(99,102,241,0.25)' : 'transparent'}`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.12)';
              (e.currentTarget as HTMLElement).style.color = '#818cf8';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = clips.length > 0 ? 'rgba(99,102,241,0.1)' : 'transparent';
              (e.currentTarget as HTMLElement).style.color = clips.length > 0 ? '#818cf8' : '#4b5563';
            }}
          >
            <span style={{ fontSize: 10 }}>Timeline</span>
          </button>
        </div>

        {/* ── Right: Controls ───────────────────────────────── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zoom control */}
          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{ border: '1px solid #21283a', background: '#1a2236' }}
          >
            <button
              onClick={handleZoomOut}
              className="flex items-center justify-center px-2 h-7 transition-colors"
              style={{ color: '#6b7280' }}
              title="Zoom Out"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#9ca3af';
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#6b7280';
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <span className="text-xs">−</span>
            </button>
            <button
              onClick={handleResetZoom}
              className="flex items-center justify-center px-2 h-7 text-xs transition-colors"
              style={{ color: '#9ca3af', minWidth: 52, textAlign: 'center' }}
              title="Reset zoom (100%)"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#e2e8f0';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#9ca3af';
              }}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="flex items-center justify-center px-2 h-7 transition-colors"
              style={{ color: '#6b7280' }}
              title="Zoom In"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#9ca3af';
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#6b7280';
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <span className="text-xs">+</span>
            </button>
          </div>

          <ToolbarDivider />

          {/* Canvas preset */}
          <div className="relative">
            <button
              onClick={() => setPresetOpen((p) => !p)}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs transition-all"
              style={{ color: '#6b7280', border: '1px solid #21283a', background: 'transparent' }}
              title="Canvas size"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#9ca3af';
                (e.currentTarget as HTMLElement).style.borderColor = '#374151';
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#6b7280';
                (e.currentTarget as HTMLElement).style.borderColor = '#21283a';
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <Monitor size={13} />
              <span className="hidden lg:inline">Canvas</span>
              <ChevronDown size={11} />
            </button>

            {presetOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPresetOpen(false)} />
                <Dropdown onClose={() => setPresetOpen(false)} minWidth={230} right>
                  <DropdownLabel>CANVAS PRESETS</DropdownLabel>
                  {CANVAS_PRESETS.map((preset) => (
                    <DropdownItem
                      key={preset.label}
                      label={preset.label}
                      note={`${preset.width}×${preset.height}`}
                      onClick={() => {
                        setArtboardSize(preset.width, preset.height);
                        setPresetOpen(false);
                        window.dispatchEvent(
                          new CustomEvent('editor:resizeArtboard', {
                            detail: { width: preset.width, height: preset.height },
                          })
                        );
                      }}
                    />
                  ))}
                </Dropdown>
              </>
            )}
          </div>

          <ToolbarDivider />

          {/* Undo / Redo */}
          <ToolGroup>
            <ToolBtn
              active={false}
              onClick={undo}
              disabled={!canUndo()}
              title="Undo (⌘Z)"
            >
              <Undo2 size={14} />
            </ToolBtn>
            <ToolBtn
              active={false}
              onClick={redo}
              disabled={!canRedo()}
              title="Redo (⌘⇧Z)"
            >
              <Redo2 size={14} />
            </ToolBtn>
          </ToolGroup>

          <ToolbarDivider />

          {/* Collaborators indicator */}
          <div className="flex items-center -space-x-1.5">
            {['#6366f1', '#8b5cf6', '#06b6d4'].map((color, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full flex items-center justify-center border-2"
                style={{ background: color, borderColor: '#161b27', fontSize: 9, color: '#fff' }}
                title="Collaborator"
              >
                {String.fromCharCode(65 + i)}
              </div>
            ))}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center border-2 ml-1"
              style={{ background: '#1e2535', borderColor: '#161b27', color: '#6b7280', fontSize: 9 }}
              title="Invite collaborators"
            >
              <Users size={10} />
            </div>
          </div>

          {/* Share button */}
          <button
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs transition-all"
            style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}
            title="Share design"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.2)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.12)';
            }}
          >
            <Share2 size={12} />
            <span className="hidden lg:inline">Share</span>
          </button>

          {/* Export */}
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs transition-all"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(99,102,241,0.45)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(99,102,241,0.3)';
            }}
          >
            <Download size={13} />
            <span>Export</span>
          </button>
        </div>
      </header>

      {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} />}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolbarDivider() {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        background: '#21283a',
        margin: '0 2px',
        flexShrink: 0,
      }}
    />
  );
}

function ToolBtn({
  active, onClick, disabled, title, children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded-lg transition-all"
      style={{
        color: active ? '#fff' : disabled ? '#2d3748' : '#9ca3af',
        background: active ? '#6366f1' : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: active ? '0 1px 6px rgba(99,102,241,0.35)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled)
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)';
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function Dropdown({
  children, minWidth, right, onClose,
}: {
  children: React.ReactNode;
  minWidth?: number;
  right?: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute top-full mt-1.5 rounded-xl overflow-hidden z-20"
      style={{
        right: right ? 0 : undefined,
        left: right ? undefined : 0,
        background: '#1e2535',
        border: '1px solid #2d3748',
        minWidth: minWidth ?? 180,
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </div>
  );
}

function DropdownLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 py-2 text-xs"
      style={{ color: '#4b5563', borderBottom: '1px solid #2d3748', letterSpacing: '0.08em' }}
    >
      {children}
    </div>
  );
}

function DropdownItem({
  label, note, onClick,
}: {
  label: string;
  note?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2.5 text-left text-xs transition-colors"
      style={{ color: '#c9d1d9' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      <span>{label}</span>
      {note && <span style={{ color: '#4b5563', fontSize: 10 }}>{note}</span>}
    </button>
  );
}