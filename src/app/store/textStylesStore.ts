/**
 * textStylesStore — Reusable text style presets (InDesign-style)
 *
 * Data Model
 * ──────────
 * TextStylePreset  {
 *   id, name, category, isBuiltIn, createdAt,
 *   character: CharacterStyle   ← font / size / color / spacing / decoration
 *   paragraph: ParagraphStyle   ← alignment / lineHeight / indent / bullets
 * }
 *
 * Style Inheritance
 * ─────────────────
 * When applying a preset the helper merges character + paragraph props onto
 * the fabric IText object, honouring only defined (non-undefined) keys so
 * a partial override style can extend another.
 *
 * Saving Presets
 * ──────────────
 * Built-in presets live in BUILT_IN_PRESETS (in-memory, read-only).
 * User presets are stored in Zustand state and persisted to localStorage via
 * the `persist` middleware under the key 'fg-text-styles'.
 *
 * Applying Styles to Fabric.js
 * ─────────────────────────────
 * Call applyTextStyleToFabric(obj, preset, canvas) — it maps the style fields
 * to the correct fabric property names (e.g. color → fill,
 * letterSpacing → charSpacing * 100) and calls canvas.requestRenderAll().
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CharacterStyle, ParagraphStyle, TextStylePreset } from '../types/editor';

// ─── Built-in presets (read-only, always shown at top) ────────────────────────

export const BUILT_IN_PRESETS: TextStylePreset[] = [
  {
    id: 'bi_h1', name: 'Heading 1', category: 'heading', isBuiltIn: true, createdAt: 0,
    character: { fontFamily: 'Inter', fontSize: 48, fontWeight: 'bold', color: '#111827', lineHeight: 1.2 },
    paragraph: { textAlign: 'left', lineHeight: 1.2 },
  },
  {
    id: 'bi_h2', name: 'Heading 2', category: 'heading', isBuiltIn: true, createdAt: 0,
    character: { fontFamily: 'Inter', fontSize: 36, fontWeight: 'bold', color: '#1f2937', lineHeight: 1.25 },
    paragraph: { textAlign: 'left', lineHeight: 1.25 },
  },
  {
    id: 'bi_h3', name: 'Heading 3', category: 'subheading', isBuiltIn: true, createdAt: 0,
    character: { fontFamily: 'Inter', fontSize: 24, fontWeight: '600', color: '#374151', lineHeight: 1.35 },
    paragraph: { textAlign: 'left', lineHeight: 1.35 },
  },
  {
    id: 'bi_sub', name: 'Subheading', category: 'subheading', isBuiltIn: true, createdAt: 0,
    character: { fontFamily: 'Inter', fontSize: 18, fontWeight: '500', color: '#4b5563', lineHeight: 1.4 },
    paragraph: { textAlign: 'left', lineHeight: 1.4 },
  },
  {
    id: 'bi_body', name: 'Body', category: 'body', isBuiltIn: true, createdAt: 0,
    character: { fontFamily: 'Inter', fontSize: 16, fontWeight: 'normal', color: '#374151', lineHeight: 1.6 },
    paragraph: { textAlign: 'left', lineHeight: 1.6 },
  },
  {
    id: 'bi_body_sm', name: 'Body Small', category: 'body', isBuiltIn: true, createdAt: 0,
    character: { fontFamily: 'Inter', fontSize: 14, fontWeight: 'normal', color: '#6b7280', lineHeight: 1.6 },
    paragraph: { textAlign: 'left', lineHeight: 1.6 },
  },
  {
    id: 'bi_caption', name: 'Caption', category: 'caption', isBuiltIn: true, createdAt: 0,
    character: { fontFamily: 'Inter', fontSize: 12, fontWeight: 'normal', color: '#9ca3af', lineHeight: 1.4 },
    paragraph: { textAlign: 'left', lineHeight: 1.4 },
  },
  {
    id: 'bi_label', name: 'Label', category: 'caption', isBuiltIn: true, createdAt: 0,
    character: { fontFamily: 'Inter', fontSize: 11, fontWeight: 'bold', color: '#374151', letterSpacing: 0.12, lineHeight: 1.2 },
    paragraph: { textAlign: 'left', lineHeight: 1.2 },
  },
  {
    id: 'bi_quote', name: 'Blockquote', category: 'body', isBuiltIn: true, createdAt: 0,
    character: { fontFamily: 'Georgia', fontSize: 20, fontStyle: 'italic', color: '#374151', lineHeight: 1.65 },
    paragraph: { textAlign: 'left', lineHeight: 1.65, indentation: 24 },
  },
  {
    id: 'bi_code', name: 'Code', category: 'body', isBuiltIn: true, createdAt: 0,
    character: { fontFamily: 'Courier New', fontSize: 14, fontWeight: 'normal', color: '#7c3aed', letterSpacing: 0.02, lineHeight: 1.6 },
    paragraph: { textAlign: 'left', lineHeight: 1.6 },
  },
  {
    id: 'bi_display', name: 'Display', category: 'heading', isBuiltIn: true, createdAt: 0,
    character: { fontFamily: 'Impact', fontSize: 72, fontWeight: 'bold', color: '#111827', lineHeight: 1.1 },
    paragraph: { textAlign: 'center', lineHeight: 1.1 },
  },
  {
    id: 'bi_eyebrow', name: 'Eyebrow', category: 'caption', isBuiltIn: true, createdAt: 0,
    character: { fontFamily: 'Inter', fontSize: 11, fontWeight: 'bold', color: '#6366f1', letterSpacing: 0.15, lineHeight: 1.2 },
    paragraph: { textAlign: 'left', lineHeight: 1.2 },
  },
];

// ─── Store ────────────────────────────────────────────────────────────────────

let _styleCounter = 0;
const nextStyleId = () => `style_${Date.now()}_${++_styleCounter}`;

interface TextStylesState {
  /** User-created presets (persisted to localStorage). Built-ins are separate. */
  userPresets: TextStylePreset[];

  /** Returns built-ins first, then user presets. */
  getAllPresets: () => TextStylePreset[];

  /** Create a new user preset; returns its id. */
  addPreset: (data: Omit<TextStylePreset, 'id' | 'isBuiltIn' | 'createdAt'>) => string;

  /** Overwrite fields of an existing user preset. */
  updatePreset: (id: string, updates: Partial<Omit<TextStylePreset, 'id' | 'isBuiltIn'>>) => void;

  /** Delete a user preset (built-ins cannot be deleted). */
  deletePreset: (id: string) => void;

  /** Clone any preset (built-in or user) into a new user preset. */
  duplicatePreset: (id: string) => void;

  /** Drag-to-reorder within the user presets list. */
  reorderUserPresets: (fromIndex: number, toIndex: number) => void;

  /**
   * Creates a new user preset from the properties of a selected Fabric.js
   * IText / Text object. Pass the name for the new preset.
   */
  createFromFabricObject: (obj: any, name: string) => string;
}

export const useTextStylesStore = create<TextStylesState>()(
  persist(
    (set, get) => ({
      userPresets: [],

      getAllPresets: () => [...BUILT_IN_PRESETS, ...get().userPresets],

      addPreset: (data) => {
        const id = nextStyleId();
        const preset: TextStylePreset = { ...data, id, isBuiltIn: false, createdAt: Date.now() };
        set((s) => ({ userPresets: [...s.userPresets, preset] }));
        return id;
      },

      updatePreset: (id, updates) => {
        set((s) => ({
          userPresets: s.userPresets.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }));
      },

      deletePreset: (id) => {
        set((s) => ({ userPresets: s.userPresets.filter((p) => p.id !== id) }));
      },

      duplicatePreset: (id) => {
        const all = get().getAllPresets();
        const src = all.find((p) => p.id === id);
        if (!src) return;
        get().addPreset({
          name: `${src.name} (copy)`,
          category: 'custom',
          character: { ...src.character },
          paragraph: { ...src.paragraph },
        });
      },

      reorderUserPresets: (from, to) => {
        set((s) => {
          const list = [...s.userPresets];
          const [moved] = list.splice(from, 1);
          list.splice(to, 0, moved);
          return { userPresets: list };
        });
      },

      createFromFabricObject: (obj, name) => {
        const character: CharacterStyle = {
          fontFamily: obj.fontFamily ?? 'Inter',
          fontSize: obj.fontSize ?? 16,
          fontWeight: obj.fontWeight ?? 'normal',
          fontStyle: obj.fontStyle ?? 'normal',
          color: typeof obj.fill === 'string' ? obj.fill : '#111827',
          letterSpacing: obj.charSpacing ? obj.charSpacing / 100 : 0,
          lineHeight: obj.lineHeight ?? 1.4,
          underline: obj.underline ?? false,
        };
        const paragraph: ParagraphStyle = {
          textAlign: obj.textAlign ?? 'left',
          lineHeight: obj.lineHeight ?? 1.4,
        };
        return get().addPreset({ name, category: 'custom', character, paragraph });
      },
    }),
    {
      name: 'fg-text-styles',
      // Only persist user presets — built-ins are always in-memory
      partialize: (state) => ({ userPresets: state.userPresets }),
    }
  )
);

// ─── Apply helpers ────────────────────────────────────────────────────────────

/**
 * Applies a TextStylePreset to a Fabric.js IText / Text object.
 *
 * Property mapping:
 *  character.color          → obj.fill
 *  character.letterSpacing  → obj.charSpacing = letterSpacing * 100
 *  paragraph.textAlign      → obj.textAlign
 *  paragraph.lineHeight     → obj.lineHeight  (paragraph wins over character)
 *
 * Style inheritance: call applyTextStyleToFabric with a merged preset to
 * chain overrides — e.g. Object.assign({}, basePreset, localOverride).
 */
export function applyTextStyleToFabric(
  obj: any,
  preset: TextStylePreset,
  canvas: any
): void {
  const { character: ch, paragraph: pg } = preset;
  const updates: Record<string, unknown> = {};

  if (ch.fontFamily !== undefined)   updates.fontFamily   = ch.fontFamily;
  if (ch.fontSize !== undefined)     updates.fontSize     = ch.fontSize;
  if (ch.fontWeight !== undefined)   updates.fontWeight   = ch.fontWeight;
  if (ch.fontStyle !== undefined)    updates.fontStyle    = ch.fontStyle;
  if (ch.color !== undefined)        updates.fill         = ch.color;
  if (ch.letterSpacing !== undefined) updates.charSpacing = ch.letterSpacing * 100;
  if (ch.underline !== undefined)    updates.underline    = ch.underline;

  // Paragraph line height takes precedence over character line height
  const lh = pg.lineHeight ?? ch.lineHeight;
  if (lh !== undefined) updates.lineHeight = lh;

  if (pg.textAlign !== undefined) updates.textAlign = pg.textAlign;

  obj.set(updates);

  if (canvas) canvas.requestRenderAll();
}

/**
 * Returns a summary string describing the character style for display in the
 * style panel (e.g. "Inter · 16px · Bold").
 */
export function describeCharacterStyle(ch: CharacterStyle): string {
  const parts: string[] = [];
  if (ch.fontFamily) parts.push(ch.fontFamily);
  if (ch.fontSize)   parts.push(`${ch.fontSize}px`);
  if (ch.fontWeight && ch.fontWeight !== 'normal') {
    parts.push(ch.fontWeight === 'bold' ? 'Bold' : `W${ch.fontWeight}`);
  }
  if (ch.fontStyle === 'italic') parts.push('Italic');
  return parts.join(' · ');
}
