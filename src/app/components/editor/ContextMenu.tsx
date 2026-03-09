import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { useArtboardStore } from '../../store/artboardStore';
import {
  Copy, Trash2, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown,
  Lock, Unlock, Eye, EyeOff, Layers2, ArrowRight, FileText,
} from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    canvas,
    selectedObjects,
    deleteSelected,
    duplicateSelected,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    layers,
    toggleLock,
    toggleVisibility,
  } = useEditorStore();

  const { pages, activePageId, moveObjectsToPage } = useArtboardStore();
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const activeObj = selectedObjects[0] as any;
  const hasSelection = selectedObjects.length > 0;
  const isLocked = activeObj && !activeObj.selectable;
  const isHidden = activeObj && !activeObj.visible;
  const isMulti = selectedObjects.length > 1;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Slight delay so the triggering click doesn't immediately close
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 80);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Clamp position so menu stays in viewport
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  const menuW = 196;
  const menuH = 320;
  const cx = x + menuW > vpW ? x - menuW : x;
  const cy = y + menuH > vpH ? y - menuH : y;

  const run = (fn: () => void) => { fn(); onClose(); };

  const findLayer = (obj: any) =>
    layers.find((l) => l.id === (obj as any).__id);

  const sep = <div style={{ height: 1, background: '#21283a', margin: '3px 0' }} />;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-lg overflow-hidden py-1 select-none"
      style={{
        left: cx,
        top: cy,
        width: menuW,
        background: '#1a2030',
        border: '1px solid #2d3748',
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {hasSelection ? (
        <>
          <MenuItem
            icon={<Copy size={12} />}
            label="Duplicate"
            shortcut="⌘D"
            onClick={() => run(duplicateSelected)}
          />
          <MenuItem
            icon={<Trash2 size={12} />}
            label="Delete"
            shortcut="Del"
            onClick={() => run(deleteSelected)}
            danger
          />
          {sep}
          <MenuItem
            icon={<ChevronsUp size={12} />}
            label="Bring to Front"
            shortcut="⌘⇧]"
            onClick={() => run(() => bringToFront(activeObj))}
          />
          <MenuItem
            icon={<ChevronUp size={12} />}
            label="Bring Forward"
            shortcut="⌘]"
            onClick={() => run(() => bringForward(activeObj))}
          />
          <MenuItem
            icon={<ChevronDown size={12} />}
            label="Send Backward"
            shortcut="⌘["
            onClick={() => run(() => sendBackward(activeObj))}
          />
          <MenuItem
            icon={<ChevronsDown size={12} />}
            label="Send to Back"
            shortcut="⌘⇧["
            onClick={() => run(() => sendToBack(activeObj))}
          />
          {sep}
          <MenuItem
            icon={isLocked ? <Unlock size={12} /> : <Lock size={12} />}
            label={isLocked ? 'Unlock' : 'Lock'}
            onClick={() => {
              const layer = findLayer(activeObj);
              if (layer) run(() => toggleLock(layer.id));
              else onClose();
            }}
          />
          <MenuItem
            icon={isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
            label={isHidden ? 'Show' : 'Hide'}
            onClick={() => {
              const layer = findLayer(activeObj);
              if (layer) run(() => toggleVisibility(layer.id));
              else onClose();
            }}
          />
          {isMulti && (
            <>
              {sep}
              <MenuItem
                icon={<Layers2 size={12} />}
                label="Group"
                shortcut="⌘G"
                onClick={() => {
                  // Group selected objects
                  if (!canvas) return;
                  const objs = canvas.getActiveObjects();
                  canvas.discardActiveObject();
                  const group = new (window as any).fabric.Group(objs, {
                    canvas,
                  });
                  objs.forEach((o: any) => canvas.remove(o));
                  (group as any).__id = `obj_${Date.now()}`;
                  (group as any).__name = 'Group';
                  canvas.add(group);
                  canvas.setActiveObject(group);
                  canvas.renderAll();
                  onClose();
                }}
              />
            </>
          )}
          {/* Move to Page (only when multiple pages exist) */}
          {pages.length > 1 && (
            <>
              {sep}
              <div className="relative">
                <MenuItem
                  icon={<ArrowRight size={12} />}
                  label="Move to Page…"
                  onClick={() => setShowMoveMenu((v) => !v)}
                  arrow
                />
                {showMoveMenu && (
                  <div
                    className="absolute left-full top-0 z-50 rounded-lg py-1 overflow-hidden"
                    style={{
                      width: 180,
                      background: '#1a2030',
                      border: '1px solid #2d3748',
                      boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
                    }}
                  >
                    {pages
                      .filter((p) => p.id !== activePageId)
                      .map((p, i) => (
                        <button
                          key={p.id}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors"
                          style={{ color: '#c9d1d9', background: 'transparent' }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.12)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                          onClick={() => {
                            moveObjectsToPage(p.id);
                            onClose();
                          }}
                        >
                          <FileText size={10} style={{ color: '#6b7280' }} />
                          <span className="flex-1 truncate">{p.name}</span>
                          <span style={{ color: '#374151', fontSize: 10 }}>
                            {pages.indexOf(p) + 1}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <MenuItem
            icon={<Copy size={12} />}
            label="Paste"
            shortcut="⌘V"
            onClick={onClose}
            disabled
          />
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  danger,
  disabled,
  arrow,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  arrow?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-colors"
      style={{
        color: disabled ? '#374151' : danger ? '#f87171' : '#c9d1d9',
        cursor: disabled ? 'default' : 'pointer',
        background: 'transparent',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLElement).style.background = danger
          ? 'rgba(239,68,68,0.12)'
          : 'rgba(99,102,241,0.12)';
        (e.currentTarget as HTMLElement).style.color = danger ? '#fca5a5' : '#e2e8f0';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = disabled ? '#374151' : danger ? '#f87171' : '#c9d1d9';
      }}
    >
      <span style={{ color: 'inherit', opacity: 0.7 }}>{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span style={{ color: '#4b5563', fontSize: 10 }}>{shortcut}</span>
      )}
      {arrow && (
        <span style={{ color: '#4b5563', fontSize: 10 }}>→</span>
      )}
    </button>
  );
}