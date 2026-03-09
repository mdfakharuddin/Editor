/**
 * TextStylesPanel — InDesign-style reusable text style presets.
 *
 * Sections
 * ────────
 *  ① Quick-add text (Heading / Body / Caption buttons)
 *  ② Built-in style presets (read-only, always visible)
 *  ③ User style presets (create, edit, duplicate, delete)
 *
 * Applying a style
 * ────────────────
 * Select a text object on the canvas → click a preset → all character +
 * paragraph properties are applied via applyTextStyleToFabric().
 *
 * Creating styles
 * ───────────────
 * "New Style" button opens an inline form to name the style (captures the
 * current selection's properties). Or right-click / "…" on any built-in to
 * duplicate it into a user preset for editing.
 *
 * Editing user presets
 * ────────────────────
 * Clicking the pencil icon on a user preset opens an inline editor panel
 * where every character + paragraph field can be modified. Changes are
 * persisted automatically to localStorage via the Zustand persist middleware.
 */

import React, { useState } from 'react';
import {
  Type, Plus, Trash2, Copy, Pencil, Check, X,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Bold, Italic, Underline, ChevronDown, ChevronUp,
  Sparkles, Star,
} from 'lucide-react';
import {
  useTextStylesStore,
  BUILT_IN_PRESETS,
  applyTextStyleToFabric,
  describeCharacterStyle,
} from '../../../store/textStylesStore';
import type { TextStylePreset, CharacterStyle, ParagraphStyle } from '../../../types/editor';
import { useEditorStore } from '../../../store/editorStore';

// ─── Shared micro-components ──────────────────────────────────────────────────

function SectionHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pt-4 pb-1.5">
      <span style={{ color: '#4b5563', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </span>
      {action}
    </div>
  );
}

function IconBtn({
  onClick, title, children, danger,
}: {
  onClick: (e: React.MouseEvent) => void;
  title?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1 rounded transition-colors"
      style={{ color: '#4b5563' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.color = danger ? '#ef4444' : '#e2e8f0';
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.color = '#4b5563';
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

// ─── Style preset card ────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  heading: '#6366f1',
  subheading: '#8b5cf6',
  body: '#10b981',
  caption: '#f59e0b',
  custom: '#ec4899',
};

interface PresetCardProps {
  preset: TextStylePreset;
  onApply: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  isEditable: boolean;
}

function PresetCard({ preset, onApply, onDuplicate, onDelete, onEdit, isEditable }: PresetCardProps) {
  const [hovered, setHovered] = useState(false);
  const ch = preset.character;
  const catColor = CATEGORY_COLORS[preset.category] ?? '#6366f1';

  return (
    <div
      className="group relative mx-3 mb-1.5 rounded-lg overflow-hidden cursor-pointer transition-all"
      style={{
        background: hovered ? 'rgba(255,255,255,0.04)' : '#1a2030',
        border: `1px solid ${hovered ? '#374151' : '#21283a'}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onApply}
    >
      {/* Category stripe */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: catColor, borderRadius: '3px 0 0 3px' }} />

      <div className="flex items-center gap-2.5 pl-4 pr-2 py-2">
        {/* Font preview */}
        <div className="flex-1 min-w-0">
          <span
            style={{
              display: 'block',
              fontFamily: ch.fontFamily ?? 'Inter',
              fontSize: Math.max(Math.min((ch.fontSize ?? 16) * 0.55, 18), 9),
              fontWeight: ch.fontWeight ?? 'normal',
              fontStyle: ch.fontStyle ?? 'normal',
              color: '#d1d5db',
              lineHeight: 1.2,
              textDecoration: ch.underline ? 'underline' : 'none',
              letterSpacing: ch.letterSpacing ? `${ch.letterSpacing * 0.05}em` : undefined,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {preset.name}
          </span>
          <span style={{ fontSize: 9, color: '#4b5563', display: 'block', marginTop: 1 }}>
            {describeCharacterStyle(ch)}
          </span>
        </div>

        {/* Action buttons (visible on hover) */}
        <div
          className="flex items-center gap-0.5 transition-opacity"
          style={{ opacity: hovered ? 1 : 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {isEditable && onEdit && (
            <IconBtn onClick={onEdit} title="Edit style"><Pencil size={10} /></IconBtn>
          )}
          {onDuplicate && (
            <IconBtn onClick={onDuplicate} title="Duplicate style"><Copy size={10} /></IconBtn>
          )}
          {isEditable && onDelete && (
            <IconBtn onClick={onDelete} title="Delete style" danger><Trash2 size={10} /></IconBtn>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Preset editor (inline) ───────────────────────────────────────────────────

const FONT_FAMILIES = [
  'Inter', 'Arial', 'Georgia', 'Playfair Display', 'Trebuchet MS',
  'Courier New', 'Verdana', 'Impact', 'Open Sans', 'Roboto', 'Lato',
  'Montserrat', 'Times New Roman',
];

const FONT_WEIGHTS = [
  { label: 'Thin', value: '100' },
  { label: 'Light', value: '300' },
  { label: 'Regular', value: 'normal' },
  { label: 'Medium', value: '500' },
  { label: 'Semi Bold', value: '600' },
  { label: 'Bold', value: 'bold' },
  { label: 'Black', value: '900' },
];

interface PresetEditorProps {
  preset: TextStylePreset;
  onSave: (updated: Partial<Omit<TextStylePreset, 'id' | 'isBuiltIn'>>) => void;
  onCancel: () => void;
}

function PresetEditor({ preset, onSave, onCancel }: PresetEditorProps) {
  const [name, setName] = useState(preset.name);
  const [ch, setCh] = useState<CharacterStyle>({ ...preset.character });
  const [pg, setPg] = useState<ParagraphStyle>({ ...preset.paragraph });

  const updateCh = (k: keyof CharacterStyle, v: any) => setCh((s) => ({ ...s, [k]: v }));
  const updatePg = (k: keyof ParagraphStyle, v: any) => setPg((s) => ({ ...s, [k]: v }));

  return (
    <div
      className="mx-3 mb-2 rounded-xl overflow-hidden"
      style={{ background: '#1a2030', border: '1px solid #2d3748' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid #21283a', background: '#161b27' }}
      >
        <span style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Edit Style
        </span>
        <div className="flex gap-1">
          <IconBtn onClick={() => onSave({ name, character: ch, paragraph: pg })} title="Save">
            <Check size={12} style={{ color: '#34d399' }} />
          </IconBtn>
          <IconBtn onClick={onCancel} title="Cancel">
            <X size={12} style={{ color: '#f87171' }} />
          </IconBtn>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Name */}
        <div className="flex flex-col gap-1">
          <label style={{ fontSize: 10, color: '#6b7280' }}>Style name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full rounded px-2 py-1.5 text-xs outline-none"
            style={{ background: '#0d1117', border: '1px solid #2d3748', color: '#d1d5db' }}
          />
        </div>

        {/* ── Character ── */}
        <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: -4 }}>
          Character
        </div>

        {/* Font family */}
        <div className="flex flex-col gap-1">
          <label style={{ fontSize: 10, color: '#6b7280' }}>Font family</label>
          <select
            value={ch.fontFamily ?? 'Inter'}
            onChange={(e) => updateCh('fontFamily', e.target.value)}
            className="w-full rounded px-2 py-1.5 text-xs outline-none"
            style={{ background: '#0d1117', border: '1px solid #2d3748', color: '#d1d5db' }}
          >
            {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {/* Size + Weight */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 10, color: '#6b7280' }}>Size (px)</label>
            <input
              type="number"
              min={4} max={400}
              value={ch.fontSize ?? 16}
              onChange={(e) => updateCh('fontSize', Number(e.target.value))}
              onKeyDown={(e) => e.stopPropagation()}
              className="w-full rounded px-2 py-1.5 text-xs outline-none"
              style={{ background: '#0d1117', border: '1px solid #2d3748', color: '#d1d5db' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 10, color: '#6b7280' }}>Weight</label>
            <select
              value={ch.fontWeight ?? 'normal'}
              onChange={(e) => updateCh('fontWeight', e.target.value)}
              className="w-full rounded px-2 py-1.5 text-xs outline-none"
              style={{ background: '#0d1117', border: '1px solid #2d3748', color: '#d1d5db' }}
            >
              {FONT_WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
        </div>

        {/* Color + Style toggles */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-1 flex-1">
            <label style={{ fontSize: 10, color: '#6b7280' }}>Color</label>
            <div className="flex items-center gap-1.5">
              <label
                className="w-7 h-7 rounded cursor-pointer shrink-0 relative overflow-hidden"
                style={{
                  backgroundColor: ch.color ?? '#111827',
                  border: '2px solid #374151',
                }}
              >
                <input
                  type="color"
                  value={ch.color ?? '#111827'}
                  onChange={(e) => updateCh('color', e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </label>
              <input
                type="text"
                value={ch.color ?? '#111827'}
                onChange={(e) => updateCh('color', e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="flex-1 rounded px-2 py-1 text-xs outline-none font-mono"
                style={{ background: '#0d1117', border: '1px solid #2d3748', color: '#d1d5db' }}
              />
            </div>
          </div>

          {/* Style toggles */}
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 10, color: '#6b7280' }}>Style</label>
            <div className="flex gap-1">
              {[
                { key: 'fontStyle', val: 'italic', icon: <Italic size={11} />, title: 'Italic' },
                { key: 'underline', val: true, icon: <Underline size={11} />, title: 'Underline' },
              ].map(({ key, val, icon, title }) => {
                const active = key === 'fontStyle'
                  ? ch.fontStyle === 'italic'
                  : ch.underline === true;
                return (
                  <button
                    key={key}
                    title={title}
                    onClick={() => {
                      if (key === 'fontStyle') updateCh('fontStyle', active ? 'normal' : 'italic');
                      else updateCh('underline', !active);
                    }}
                    className="flex items-center justify-center w-7 h-7 rounded transition-all"
                    style={{
                      background: active ? '#6366f1' : '#0d1117',
                      border: '1px solid #2d3748',
                      color: active ? '#fff' : '#9ca3af',
                    }}
                  >
                    {icon}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Letter spacing + Line height */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 10, color: '#6b7280' }}>Letter spacing</label>
            <input
              type="number"
              min={-20} max={100} step={0.5}
              value={ch.letterSpacing ?? 0}
              onChange={(e) => updateCh('letterSpacing', Number(e.target.value))}
              onKeyDown={(e) => e.stopPropagation()}
              className="w-full rounded px-2 py-1.5 text-xs outline-none"
              style={{ background: '#0d1117', border: '1px solid #2d3748', color: '#d1d5db' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ fontSize: 10, color: '#6b7280' }}>Line height</label>
            <input
              type="number"
              min={0.5} max={5} step={0.05}
              value={pg.lineHeight ?? ch.lineHeight ?? 1.4}
              onChange={(e) => {
                const v = Number(e.target.value);
                updateCh('lineHeight', v);
                updatePg('lineHeight', v);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              className="w-full rounded px-2 py-1.5 text-xs outline-none"
              style={{ background: '#0d1117', border: '1px solid #2d3748', color: '#d1d5db' }}
            />
          </div>
        </div>

        {/* ── Paragraph ── */}
        <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: -4 }}>
          Paragraph
        </div>

        {/* Alignment */}
        <div className="flex flex-col gap-1">
          <label style={{ fontSize: 10, color: '#6b7280' }}>Alignment</label>
          <div className="flex gap-1">
            {[
              { v: 'left', icon: <AlignLeft size={11} /> },
              { v: 'center', icon: <AlignCenter size={11} /> },
              { v: 'right', icon: <AlignRight size={11} /> },
              { v: 'justify', icon: <AlignJustify size={11} /> },
            ].map(({ v, icon }) => (
              <button
                key={v}
                onClick={() => updatePg('textAlign', v as ParagraphStyle['textAlign'])}
                className="flex-1 flex items-center justify-center py-1.5 rounded transition-all"
                style={{
                  background: pg.textAlign === v ? '#6366f1' : '#0d1117',
                  border: '1px solid #2d3748',
                  color: pg.textAlign === v ? '#fff' : '#9ca3af',
                }}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Indentation */}
        <div className="flex flex-col gap-1">
          <label style={{ fontSize: 10, color: '#6b7280' }}>Indentation (px)</label>
          <input
            type="number"
            min={0} max={200}
            value={pg.indentation ?? 0}
            onChange={(e) => updatePg('indentation', Number(e.target.value))}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full rounded px-2 py-1.5 text-xs outline-none"
            style={{ background: '#0d1117', border: '1px solid #2d3748', color: '#d1d5db' }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── New style form ───────────────────────────────────────────────────────────

interface NewStyleFormProps {
  onSave: (name: string, category: TextStylePreset['category']) => void;
  onCancel: () => void;
}

function NewStyleForm({ onSave, onCancel }: NewStyleFormProps) {
  const [name, setName] = useState('My Style');
  const [category, setCategory] = useState<TextStylePreset['category']>('custom');

  return (
    <div
      className="mx-3 mb-2 rounded-xl overflow-hidden"
      style={{ background: '#1a2030', border: '1px solid #2d3748' }}
    >
      <div className="px-3 py-2 flex flex-col gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') onSave(name.trim(), category);
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="Style name…"
          className="w-full rounded px-2 py-1.5 text-xs outline-none"
          style={{ background: '#0d1117', border: '1px solid #6366f1', color: '#d1d5db' }}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as TextStylePreset['category'])}
          className="w-full rounded px-2 py-1.5 text-xs outline-none"
          style={{ background: '#0d1117', border: '1px solid #2d3748', color: '#d1d5db' }}
        >
          <option value="heading">Heading</option>
          <option value="subheading">Subheading</option>
          <option value="body">Body</option>
          <option value="caption">Caption</option>
          <option value="custom">Custom</option>
        </select>
        <div className="flex gap-1.5">
          <button
            onClick={() => onSave(name.trim(), category)}
            className="flex-1 py-1.5 rounded text-xs transition-colors"
            style={{ background: '#6366f1', color: '#fff' }}
          >
            Create
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-1.5 rounded text-xs transition-colors"
            style={{ background: '#1e2535', color: '#6b7280', border: '1px solid #2d3748' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface TextStylesPanelProps {
  onAddShape: (type: 'rect' | 'circle' | 'line' | 'text') => void;
}

export function TextStylesPanel({ onAddShape }: TextStylesPanelProps) {
  const { userPresets, addPreset, updatePreset, deletePreset, duplicatePreset, createFromFabricObject } =
    useTextStylesStore();
  const { canvas, selectedObjects } = useEditorStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [builtInCollapsed, setBuiltInCollapsed] = useState(false);

  const activeTextObj = selectedObjects[0] as any;
  const isTextSelected =
    activeTextObj && (activeTextObj.type === 'i-text' || activeTextObj.type === 'text');

  const applyPreset = (preset: TextStylePreset) => {
    if (!isTextSelected || !canvas) return;
    applyTextStyleToFabric(activeTextObj, preset, canvas);
    // Commit to history
    setTimeout(() => {
      useEditorStore.getState().pushHistory(
        JSON.stringify(canvas.toJSON(['__id', '__name', '__isArtboard']))
      );
    }, 20);
  };

  const handleNewStyle = (name: string, category: TextStylePreset['category']) => {
    if (!name) return;
    if (isTextSelected) {
      createFromFabricObject(activeTextObj, name);
    } else {
      addPreset({
        name,
        category,
        character: { fontFamily: 'Inter', fontSize: 16, fontWeight: 'normal', color: '#111827', lineHeight: 1.5 },
        paragraph: { textAlign: 'left', lineHeight: 1.5 },
      });
    }
    setShowNewForm(false);
  };

  const handleSaveEdit = (id: string, updates: Partial<Omit<TextStylePreset, 'id' | 'isBuiltIn'>>) => {
    updatePreset(id, updates);
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Quick-add bar ───────────────────────────────────── */}
      <div className="p-3 shrink-0" style={{ borderBottom: '1px solid #21283a' }}>
        <button
          onClick={() => onAddShape('text')}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all"
          style={{
            background: 'rgba(99,102,241,0.1)',
            border: '1.5px dashed rgba(99,102,241,0.35)',
            color: '#818cf8',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.18)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.55)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.1)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.35)';
          }}
        >
          <Type size={14} />
          <span className="text-xs">Add text to canvas</span>
        </button>

        {/* Context tip */}
        {isTextSelected ? (
          <div
            className="mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <Type size={10} style={{ color: '#818cf8', flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#818cf8' }}>
              Text selected — click a style to apply
            </span>
          </div>
        ) : (
          <div
            className="mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
            style={{ background: 'rgba(30,37,53,0.6)', border: '1px solid #21283a' }}
          >
            <span style={{ fontSize: 10, color: '#374151' }}>
              Select a text object to apply styles
            </span>
          </div>
        )}
      </div>

      {/* ── Scrollable presets ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>

        {/* Built-in presets */}
        <SectionHeader
          action={
            <button
              onClick={() => setBuiltInCollapsed((v) => !v)}
              style={{ color: '#374151' }}
              className="p-0.5 rounded transition-colors"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#9ca3af'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#374151'; }}
            >
              {builtInCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>
          }
        >
          <div className="flex items-center gap-1.5">
            <Star size={9} style={{ color: '#4b5563' }} />
            Built-in
          </div>
        </SectionHeader>

        {!builtInCollapsed && BUILT_IN_PRESETS.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            isEditable={false}
            onApply={() => applyPreset(preset)}
            onDuplicate={() => duplicatePreset(preset.id)}
          />
        ))}

        {/* User presets */}
        <SectionHeader
          action={
            <button
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: '#6366f1' }}
              onClick={() => setShowNewForm((v) => !v)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#818cf8'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#6366f1'; }}
            >
              <Plus size={11} />
              <span style={{ fontSize: 10 }}>New</span>
            </button>
          }
        >
          <div className="flex items-center gap-1.5">
            <Sparkles size={9} style={{ color: '#4b5563' }} />
            My Styles
          </div>
        </SectionHeader>

        {showNewForm && (
          <NewStyleForm
            onSave={handleNewStyle}
            onCancel={() => setShowNewForm(false)}
          />
        )}

        {userPresets.length === 0 && !showNewForm && (
          <div className="px-3 pb-4 flex flex-col items-center gap-2 pt-2">
            <div
              className="w-full rounded-xl flex flex-col items-center gap-2 py-5"
              style={{ background: '#1a2030', border: '1px dashed #21283a' }}
            >
              <Sparkles size={18} style={{ color: '#2d3748' }} />
              <p style={{ fontSize: 10, color: '#374151', textAlign: 'center', lineHeight: 1.5 }}>
                No custom styles yet.<br />
                {isTextSelected
                  ? 'Click "+ New" to save the current text style.'
                  : 'Duplicate a built-in style to get started.'}
              </p>
            </div>
          </div>
        )}

        {userPresets.map((preset) =>
          editingId === preset.id ? (
            <PresetEditor
              key={preset.id}
              preset={preset}
              onSave={(updates) => handleSaveEdit(preset.id, updates)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <PresetCard
              key={preset.id}
              preset={preset}
              isEditable={true}
              onApply={() => applyPreset(preset)}
              onEdit={() => setEditingId(preset.id)}
              onDuplicate={() => duplicatePreset(preset.id)}
              onDelete={() => deletePreset(preset.id)}
            />
          )
        )}

        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
