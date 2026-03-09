/**
 * ArtboardsPanel — horizontal page navigation strip at the bottom of the editor.
 *
 * Features:
 *  • Thumbnail previews of every page (captured on page-switch)
 *  • Click to navigate, double-click name to rename
 *  • Drag-to-reorder pages horizontally
 *  • Context menu: Duplicate, Delete, Rename, Set size, Set background
 *  • "+" button to add a blank page or choose a size preset
 *  • Active page highlighted with indigo border
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Copy, Trash2, ChevronLeft, ChevronRight,
  FileText, MoreHorizontal, Maximize2, Palette,
} from 'lucide-react';
import { useArtboardStore } from '../../store/artboardStore';
import { CANVAS_PRESETS } from '../../types/editor';

const THUMB_W = 100;
const THUMB_H = 66;

// ─── Utility ──────────────────────────────────────────────────────────────────
function ratio(w: number, h: number): { tw: number; th: number } {
  const r = w / h;
  if (r > THUMB_W / THUMB_H) {
    return { tw: THUMB_W, th: Math.round(THUMB_W / r) };
  }
  return { tw: Math.round(THUMB_H * r), th: THUMB_H };
}

// ─── Context menu ─────────────────────────────────────────────────────────────
interface PageMenuProps {
  pageId: string;
  x: number;
  y: number;
  onClose: () => void;
}

function PageContextMenu({ pageId, x, y, onClose }: PageMenuProps) {
  const { pages, duplicatePage, deletePage, updatePageBackground, updatePageSize } = useArtboardStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const [showSizes, setShowSizes] = useState(false);
  const pageCount = pages.length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 60);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Clamp position
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mw = 200, mh = 200;
  const cx = x + mw > vw ? x - mw : x;
  const cy = y + mh > vh ? y - mh : y;

  const run = (fn: () => void) => { fn(); onClose(); };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 py-1 rounded-lg overflow-hidden"
      style={{
        left: cx, top: cy, width: mw,
        background: '#1a2030',
        border: '1px solid #2d3748',
        boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
      }}
    >
      <CtxItem icon={<Copy size={12} />} label="Duplicate" onClick={() => run(() => duplicatePage(pageId))} />
      <CtxItem
        icon={<Trash2 size={12} />}
        label="Delete"
        danger
        disabled={pageCount <= 1}
        onClick={() => run(() => deletePage(pageId))}
      />
      <div style={{ height: 1, background: '#21283a', margin: '3px 0' }} />

      {/* Resize presets submenu toggle */}
      <CtxItem
        icon={<Maximize2 size={12} />}
        label="Resize to…"
        onClick={() => setShowSizes((v) => !v)}
        arrow
      />
      {showSizes && (
        <div className="pl-3 flex flex-col">
          {CANVAS_PRESETS.map((p) => (
            <CtxItem
              key={p.label}
              icon={null}
              label={p.label}
              onClick={() => run(() => updatePageSize(pageId, p.width, p.height))}
              small
            />
          ))}
        </div>
      )}

      {/* Background colour */}
      <div
        className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-xs"
        style={{ color: '#c9d1d9' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.12)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <span style={{ color: '#9ca3af', opacity: 0.7 }}><Palette size={12} /></span>
        <span className="flex-1">Background</span>
        <input
          type="color"
          defaultValue="#ffffff"
          onChange={(e) => updatePageBackground(pageId, e.target.value)}
          className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

function CtxItem({
  icon, label, onClick, danger, disabled, arrow, small,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  arrow?: boolean;
  small?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2.5 px-3 text-left transition-colors"
      style={{
        paddingTop: small ? 3 : 6,
        paddingBottom: small ? 3 : 6,
        fontSize: small ? 10 : 12,
        color: disabled ? '#374151' : danger ? '#f87171' : '#c9d1d9',
        cursor: disabled ? 'default' : 'pointer',
        background: 'transparent',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLElement).style.background = danger
          ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {icon && <span style={{ opacity: 0.7 }}>{icon}</span>}
      <span className="flex-1">{label}</span>
      {arrow && <ChevronRight size={10} style={{ opacity: 0.5 }} />}
    </button>
  );
}

// ─── Single page thumbnail card ───────────────────────────────────────────────
interface PageCardProps {
  page: ReturnType<typeof useArtboardStore.getState>['pages'][0];
  index: number;
  isActive: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

function PageCard({
  page, index, isActive, isDragOver,
  onSelect, onContextMenu, onDragStart, onDragOver, onDrop,
}: PageCardProps) {
  const { renamePage } = useArtboardStore();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(page.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    setEditing(false);
    const trimmed = editName.trim();
    if (trimmed && trimmed !== page.name) renamePage(page.id, trimmed);
    else setEditName(page.name);
  };

  useEffect(() => { setEditName(page.name); }, [page.name]);

  const { tw, th } = ratio(page.width, page.height);

  return (
    <div
      className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer select-none"
      style={{ padding: '6px 8px' }}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      {/* Page number badge */}
      <div className="flex items-center gap-1">
        <span
          className="text-xs"
          style={{ color: isActive ? '#818cf8' : '#374151', fontSize: 10, minWidth: 14, textAlign: 'center' }}
        >
          {index + 1}
        </span>
      </div>

      {/* Thumbnail frame */}
      <div
        style={{
          width: THUMB_W + 4,
          height: THUMB_H + 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          background: isDragOver ? 'rgba(99,102,241,0.15)' : 'transparent',
          border: isActive
            ? '2px solid #6366f1'
            : isDragOver
              ? '2px dashed rgba(99,102,241,0.5)'
              : '2px solid #21283a',
          transition: 'border-color 120ms, background 120ms',
        }}
      >
        <div
          style={{
            width: tw,
            height: th,
            borderRadius: 3,
            overflow: 'hidden',
            background: page.backgroundColor,
            boxShadow: isActive ? '0 0 0 1px rgba(99,102,241,0.4), 0 2px 8px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.3)',
            position: 'relative',
          }}
        >
          {page.thumbnail ? (
            <img
              src={page.thumbnail}
              alt={page.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              draggable={false}
            />
          ) : (
            <div
              className="flex items-center justify-center h-full"
              style={{ color: '#2d3748' }}
            >
              <FileText size={16} />
            </div>
          )}
        </div>
      </div>

      {/* Name / edit field */}
      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setEditing(false); setEditName(page.name); }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          className="rounded text-center outline-none"
          style={{
            width: THUMB_W + 4,
            fontSize: 10,
            background: '#2d3748',
            color: '#e2e8f0',
            border: '1px solid #6366f1',
            padding: '1px 4px',
          }}
        />
      ) : (
        <span
          className="block text-center truncate"
          style={{
            maxWidth: THUMB_W + 4,
            fontSize: 10,
            color: isActive ? '#c4b5fd' : '#6b7280',
            lineHeight: 1.3,
          }}
          onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
          title={page.name}
        >
          {page.name}
        </span>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export function ArtboardsPanel() {
  const { pages, activePageId, setActivePage, addPage, reorderPages } = useArtboardStore();
  const [ctxMenu, setCtxMenu] = useState<{ pageId: string; x: number; y: number } | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Horizontal scroll with mouse wheel
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY + e.deltaX;
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Scroll to active page
  useEffect(() => {
    const idx = pages.findIndex((p) => p.id === activePageId);
    const el = scrollRef.current;
    if (!el || idx < 0) return;
    // Each card is ~130px wide
    const cardW = 130;
    el.scrollTo({ left: idx * cardW - el.clientWidth / 2 + cardW / 2, behavior: 'smooth' });
  }, [activePageId, pages]);

  const scrollBy = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' });
  };

  return (
    <div
      className="flex items-center shrink-0 relative"
      style={{
        height: 116,
        background: '#0f141e',
        borderTop: '1px solid #21283a',
        zIndex: 4,
      }}
    >
      {/* Left scroll arrow */}
      <button
        className="flex items-center justify-center shrink-0 h-full px-1.5 transition-colors"
        style={{ color: '#374151' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#6b7280'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#374151'; }}
        onClick={() => scrollBy(-1)}
        title="Scroll left"
      >
        <ChevronLeft size={14} />
      </button>

      {/* Scrollable page strip */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center overflow-x-auto h-full"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', gap: 0 }}
      >
        {pages.map((page, idx) => (
          <PageCard
            key={page.id}
            page={page}
            index={idx}
            isActive={page.id === activePageId}
            isDragOver={dragOverIdx === idx}
            onSelect={() => setActivePage(page.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtxMenu({ pageId: page.id, x: e.clientX, y: e.clientY });
            }}
            onDragStart={(e) => {
              dragIdx.current = idx;
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverIdx(idx);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIdx.current !== null && dragIdx.current !== idx) {
                reorderPages(dragIdx.current, idx);
              }
              dragIdx.current = null;
              setDragOverIdx(null);
            }}
          />
        ))}

        {/* Spacer so the last card doesn't hug the right edge */}
        <div style={{ minWidth: 8, flexShrink: 0 }} />
      </div>

      {/* Right scroll arrow */}
      <button
        className="flex items-center justify-center shrink-0 h-full px-1.5 transition-colors"
        style={{ color: '#374151' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#6b7280'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#374151'; }}
        onClick={() => scrollBy(1)}
        title="Scroll right"
      >
        <ChevronRight size={14} />
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 60, background: '#21283a', flexShrink: 0 }} />

      {/* Add page section */}
      <div className="relative shrink-0 flex flex-col items-center px-3">
        <button
          className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all"
          style={{
            color: '#4b5563',
            background: showAddMenu ? 'rgba(99,102,241,0.1)' : 'transparent',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = '#818cf8';
            (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = '#4b5563';
            if (!showAddMenu) (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
          onClick={() => setShowAddMenu((v) => !v)}
          title="Add page"
        >
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 36,
              height: 28,
              border: '1.5px dashed currentColor',
              borderRadius: 5,
            }}
          >
            <Plus size={14} />
          </div>
          <span style={{ fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1 }}>
            Add Page
          </span>
        </button>

        {/* Add page dropdown */}
        {showAddMenu && (
          <div
            className="absolute z-50 rounded-lg py-1 overflow-hidden"
            style={{
              bottom: '100%',
              right: 0,
              marginBottom: 6,
              width: 210,
              background: '#1a2030',
              border: '1px solid #2d3748',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div className="px-3 py-1.5" style={{ color: '#4b5563', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              New page size
            </div>
            <AddMenuItem
              label="Blank (1200 × 800)"
              onClick={() => { addPage(); setShowAddMenu(false); }}
            />
            <div style={{ height: 1, background: '#21283a', margin: '3px 0' }} />
            {CANVAS_PRESETS.map((p) => (
              <AddMenuItem
                key={p.label}
                label={p.label}
                onClick={() => {
                  addPage({ width: p.width, height: p.height });
                  setShowAddMenu(false);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Page count badge */}
      <div
        className="shrink-0 px-2 flex flex-col items-center gap-0.5 mr-2"
        style={{ minWidth: 32 }}
      >
        <span style={{ fontSize: 16, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
          {pages.findIndex((p) => p.id === activePageId) + 1}
        </span>
        <span style={{ fontSize: 9, color: '#2d3748', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          / {pages.length}
        </span>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <PageContextMenu
          pageId={ctxMenu.pageId}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Close add menu on outside click */}
      {showAddMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowAddMenu(false)}
        />
      )}
    </div>
  );
}

function AddMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="w-full px-3 text-left transition-colors"
      style={{ fontSize: 11, color: '#c9d1d9', paddingTop: 5, paddingBottom: 5, background: 'transparent' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.12)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}