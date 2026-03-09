/**
 * TemplatesPanel — Template picker that loads full Fabric.js scenes into the canvas.
 *
 * Template JSON Schema
 * ────────────────────
 * Each template stores:
 *   • width / height  — artboard dimensions in px
 *   • bgColors        — gradient stops array (2+ hex values)
 *   • bgSolid         — fallback solid fill
 *   • objects[]       — Fabric object descriptors:
 *       type      'textbox' | 'rect' | 'ellipse' | 'line'
 *       left/top  0-1 relative to artboard width/height
 *       width     0-1 relative to artboard width
 *       height    0-1 relative to artboard height (rect/ellipse only)
 *       ... standard Fabric properties (fontSize, fill, fontWeight, etc.)
 *
 * Loading into Fabric.js
 * ──────────────────────
 * applyTemplate():
 *   1. Resizes the artboard canvas element and the artboard Rect object
 *   2. Applies a fabric.Gradient as the artboard fill (gradient templates)
 *      or sets fill directly (solid templates)
 *   3. Clears all non-artboard canvas objects
 *   4. Creates fabric.Textbox / fabric.Rect / fabric.Ellipse objects from
 *      the template schema with coordinates translated from relative → px
 *   5. Calls canvas.renderAll() and syncs the Layers panel
 *
 * Editing template content
 * ─────────────────────────
 * After applying, every object is a normal Fabric.js object — users can
 * double-click text to edit it, drag to reposition, use the Properties panel
 * to change colors/fonts, etc. Templates are just a starting point.
 *
 * Template marketplace possibility
 * ─────────────────────────────────
 * Templates are plain JSON and can be fetched from an API endpoint:
 *   GET /api/templates?category=social&page=1
 * The applyTemplate() function already accepts the JSON structure, so
 * remote templates work with no code changes.
 */

import { useState } from 'react';
import { Search, ChevronRight, Check } from 'lucide-react';
import { useEditorStore, generateId, syncLayersFromCanvas } from '../../../store/editorStore';

// ─── Template schema ──────────────────────────────────────────────────────────

interface TemplateObject {
  type: 'textbox' | 'rect' | 'ellipse' | 'line';
  text?: string;
  left: number;   // 0-1 relative
  top: number;    // 0-1 relative
  width?: number; // 0-1 relative
  height?: number;// 0-1 relative
  fill?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: string;
  opacity?: number;
  rx?: number;
  angle?: number;
}

interface Template {
  id: string;
  label: string;
  category: string;
  width: number;
  height: number;
  bgColors?: string[];   // gradient stops
  bgSolid?: string;      // solid fill fallback
  bg: string;            // CSS for preview card
  accent: string;
  preview: 'banner' | 'post' | 'slide' | 'doc';
  objects: TemplateObject[];
}

// ─── Template data ────────────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  {
    id: 't1', label: 'Modern Gradient', category: 'social',
    width: 1080, height: 1080,
    bg: 'linear-gradient(135deg,#6366f1,#8b5cf6)', bgColors: ['#6366f1', '#8b5cf6'],
    accent: '#fff', preview: 'post',
    objects: [
      { type: 'textbox', text: 'YOUR HEADLINE', left: 0.1, top: 0.3, width: 0.8, fill: '#fff', fontSize: 80, fontWeight: 'bold', fontFamily: 'Inter, Arial, sans-serif', textAlign: 'center' },
      { type: 'textbox', text: 'Add a compelling subtitle that drives engagement', left: 0.1, top: 0.52, width: 0.8, fill: 'rgba(255,255,255,0.75)', fontSize: 32, fontFamily: 'Inter, Arial, sans-serif', textAlign: 'center' },
      { type: 'rect', left: 0.35, top: 0.7, width: 0.3, height: 0.055, fill: '#fff', rx: 40 },
    ],
  },
  {
    id: 't2', label: 'Bold Headline', category: 'presentation',
    width: 1920, height: 1080,
    bg: 'linear-gradient(135deg,#0f172a,#1e293b)', bgColors: ['#0f172a', '#1e293b'],
    accent: '#6366f1', preview: 'slide',
    objects: [
      { type: 'rect', left: 0.0, top: 0.0, width: 0.008, height: 1.0, fill: '#6366f1' },
      { type: 'textbox', text: 'Presentation Title', left: 0.06, top: 0.28, width: 0.88, fill: '#e2e8f0', fontSize: 88, fontWeight: 'bold', fontFamily: 'Inter, Arial, sans-serif' },
      { type: 'textbox', text: 'Subtitle · Author · Date', left: 0.06, top: 0.56, width: 0.8, fill: '#6366f1', fontSize: 36, fontFamily: 'Inter, Arial, sans-serif' },
      { type: 'textbox', text: 'Supporting details go here — keep it concise and impactful', left: 0.06, top: 0.68, width: 0.7, fill: 'rgba(226,232,240,0.5)', fontSize: 26, fontFamily: 'Inter, Arial, sans-serif' },
    ],
  },
  {
    id: 't3', label: 'Minimal White', category: 'document',
    width: 794, height: 1123,
    bg: '#f8fafc', bgSolid: '#f8fafc',
    accent: '#1e293b', preview: 'doc',
    objects: [
      { type: 'rect', left: 0.0, top: 0.0, width: 1.0, height: 0.12, fill: '#1e293b' },
      { type: 'textbox', text: 'Document Title', left: 0.06, top: 0.03, width: 0.88, fill: '#fff', fontSize: 40, fontWeight: 'bold', fontFamily: 'Georgia, serif' },
      { type: 'textbox', text: 'Section heading', left: 0.06, top: 0.16, width: 0.88, fill: '#1e293b', fontSize: 24, fontWeight: 'bold', fontFamily: 'Georgia, serif' },
      { type: 'rect', left: 0.06, top: 0.22, width: 0.88, height: 0.003, fill: '#e2e8f0' },
      { type: 'textbox', text: 'Begin typing your document content here. This template provides a clean, professional layout suitable for reports, proposals, and formal documents.', left: 0.06, top: 0.24, width: 0.88, fill: '#374151', fontSize: 16, fontFamily: 'Georgia, serif' },
    ],
  },
  {
    id: 't4', label: 'Sunset Story', category: 'social',
    width: 1080, height: 1920,
    bg: 'linear-gradient(160deg,#f97316,#ec4899)', bgColors: ['#f97316', '#db2777', '#7c3aed'],
    accent: '#fff', preview: 'post',
    objects: [
      { type: 'textbox', text: '✦', left: 0.5, top: 0.1, width: 0.2, fill: '#fff', fontSize: 60, textAlign: 'center' },
      { type: 'textbox', text: 'YOUR STORY', left: 0.08, top: 0.38, width: 0.84, fill: '#fff', fontSize: 96, fontWeight: 'bold', fontFamily: 'Inter, Arial, sans-serif', textAlign: 'center' },
      { type: 'textbox', text: 'Share what matters most', left: 0.08, top: 0.56, width: 0.84, fill: 'rgba(255,255,255,0.8)', fontSize: 36, fontFamily: 'Inter, Arial, sans-serif', textAlign: 'center' },
      { type: 'rect', left: 0.3, top: 0.66, width: 0.4, height: 0.002, fill: 'rgba(255,255,255,0.4)' },
      { type: 'textbox', text: '@yourhandle', left: 0.08, top: 0.7, width: 0.84, fill: 'rgba(255,255,255,0.6)', fontSize: 28, fontFamily: 'Inter, Arial, sans-serif', textAlign: 'center' },
    ],
  },
  {
    id: 't5', label: 'Tech Banner', category: 'marketing',
    width: 1500, height: 500,
    bg: 'linear-gradient(90deg,#0f172a,#312e81)', bgColors: ['#0f172a', '#312e81'],
    accent: '#818cf8', preview: 'banner',
    objects: [
      { type: 'textbox', text: 'PRODUCT LAUNCH', left: 0.04, top: 0.14, width: 0.5, fill: '#818cf8', fontSize: 28, fontFamily: 'Inter, Arial, sans-serif', fontWeight: 'bold' },
      { type: 'textbox', text: 'Introducing the future\nof design', left: 0.04, top: 0.28, width: 0.5, fill: '#e2e8f0', fontSize: 56, fontWeight: 'bold', fontFamily: 'Inter, Arial, sans-serif' },
      { type: 'rect', left: 0.04, top: 0.72, width: 0.18, height: 0.16, fill: '#6366f1', rx: 8 },
      { type: 'textbox', text: 'Get Started →', left: 0.05, top: 0.74, width: 0.16, fill: '#fff', fontSize: 22, fontFamily: 'Inter, Arial, sans-serif', textAlign: 'center' },
      { type: 'ellipse', left: 0.72, top: 0.05, width: 0.22, height: 0.9, fill: 'rgba(99,102,241,0.12)' },
      { type: 'ellipse', left: 0.8, top: 0.1, width: 0.15, height: 0.8, fill: 'rgba(139,92,246,0.1)' },
    ],
  },
  {
    id: 't6', label: 'Clean Report', category: 'document',
    width: 794, height: 1123,
    bg: '#ffffff', bgSolid: '#ffffff',
    accent: '#6366f1', preview: 'doc',
    objects: [
      { type: 'rect', left: 0.0, top: 0.0, width: 1.0, height: 0.055, fill: '#6366f1' },
      { type: 'textbox', text: 'Annual Report 2025', left: 0.06, top: 0.08, width: 0.88, fill: '#1e293b', fontSize: 38, fontWeight: 'bold', fontFamily: 'Inter, Arial, sans-serif' },
      { type: 'textbox', text: 'Company Name · Confidential', left: 0.06, top: 0.15, width: 0.88, fill: '#6366f1', fontSize: 16, fontFamily: 'Inter, Arial, sans-serif' },
      { type: 'rect', left: 0.06, top: 0.2, width: 0.88, height: 0.002, fill: '#e2e8f0' },
      { type: 'textbox', text: 'Executive Summary', left: 0.06, top: 0.23, width: 0.88, fill: '#1e293b', fontSize: 22, fontWeight: 'bold', fontFamily: 'Inter, Arial, sans-serif' },
      { type: 'textbox', text: 'Add your executive summary here. Highlight key achievements, financials, and strategic priorities for the year.', left: 0.06, top: 0.29, width: 0.88, fill: '#374151', fontSize: 15, fontFamily: 'Inter, Arial, sans-serif' },
    ],
  },
  {
    id: 't7', label: 'Neon Dark', category: 'social',
    width: 1080, height: 1080,
    bg: 'linear-gradient(135deg,#0f172a,#1e1b4b)', bgColors: ['#0f172a', '#1e1b4b'],
    accent: '#a78bfa', preview: 'post',
    objects: [
      { type: 'rect', left: 0.1, top: 0.1, width: 0.8, height: 0.8, fill: 'transparent', rx: 20 },
      { type: 'textbox', text: 'NEON', left: 0.05, top: 0.32, width: 0.9, fill: '#a78bfa', fontSize: 140, fontWeight: 'bold', fontFamily: 'Inter, Arial, sans-serif', textAlign: 'center' },
      { type: 'textbox', text: 'VIBES', left: 0.05, top: 0.52, width: 0.9, fill: '#818cf8', fontSize: 100, fontWeight: 'bold', fontFamily: 'Inter, Arial, sans-serif', textAlign: 'center', opacity: 0.7 },
      { type: 'textbox', text: '✦ your tagline here ✦', left: 0.05, top: 0.72, width: 0.9, fill: 'rgba(167,139,250,0.6)', fontSize: 28, fontFamily: 'Inter, Arial, sans-serif', textAlign: 'center' },
    ],
  },
  {
    id: 't8', label: 'Brand Deck', category: 'presentation',
    width: 1920, height: 1080,
    bg: 'linear-gradient(135deg,#1e3a5f,#0f172a)', bgColors: ['#1e3a5f', '#0f172a'],
    accent: '#38bdf8', preview: 'slide',
    objects: [
      { type: 'textbox', text: 'BRAND', left: 0.06, top: 0.25, width: 0.88, fill: '#38bdf8', fontSize: 100, fontWeight: 'bold', fontFamily: 'Inter, Arial, sans-serif' },
      { type: 'textbox', text: 'IDENTITY KIT', left: 0.06, top: 0.48, width: 0.88, fill: '#e2e8f0', fontSize: 80, fontWeight: 'bold', fontFamily: 'Inter, Arial, sans-serif', opacity: 0.9 },
      { type: 'rect', left: 0.06, top: 0.72, width: 0.06, height: 0.007, fill: '#38bdf8' },
      { type: 'textbox', text: 'Version 2.0  ·  2025', left: 0.06, top: 0.78, width: 0.4, fill: 'rgba(226,232,240,0.4)', fontSize: 24, fontFamily: 'Inter, Arial, sans-serif' },
    ],
  },
];

const CATEGORIES = [
  { id: 'all',          label: 'All' },
  { id: 'social',       label: 'Social' },
  { id: 'presentation', label: 'Slides' },
  { id: 'document',     label: 'Docs' },
  { id: 'marketing',    label: 'Marketing' },
];

// ─── Apply template to Fabric canvas ─────────────────────────────────────────

async function applyTemplate(template: Template) {
  const { canvas, setArtboardSize } = useEditorStore.getState();
  if (!canvas) return;

  const fabric = (window as any).fabric;
  if (!fabric) { console.error('Fabric not loaded'); return; }

  const W = template.width;
  const H = template.height;

  // 1. Resize artboard
  setArtboardSize(W, H);
  window.dispatchEvent(new CustomEvent('editor:resizeArtboard', { detail: { width: W, height: H } }));

  // 2. Clear all non-artboard objects
  const toRemove = canvas.getObjects().filter((o: any) => !o.__isArtboard);
  toRemove.forEach((o: any) => canvas.remove(o));

  // 3. Apply background to the artboard rect
  const artboard = canvas.getObjects().find((o: any) => o.__isArtboard);
  if (artboard) {
    artboard.set({ width: W, height: H });

    if (template.bgColors && template.bgColors.length >= 2) {
      try {
        const grad = new fabric.Gradient({
          type: 'linear',
          gradientUnits: 'pixels',
          coords: { x1: 0, y1: 0, x2: W, y2: H },
          colorStops: template.bgColors.map((color: string, i: number, arr: string[]) => ({
            offset: i / (arr.length - 1),
            color,
          })),
        });
        artboard.set('fill', grad);
      } catch {
        artboard.set('fill', template.bgSolid ?? template.bgColors[0]);
      }
    } else {
      artboard.set('fill', template.bgSolid ?? '#ffffff');
    }
  }

  // 4. Add template objects
  const created: any[] = [];
  for (const obj of template.objects) {
    let fabObj: any = null;
    const left  = obj.left  * W;
    const top   = obj.top   * H;
    const width = (obj.width  ?? 0.5) * W;
    const height= (obj.height ?? 0.1) * H;

    const base: any = {
      left, top,
      fill:       obj.fill       ?? '#000000',
      opacity:    obj.opacity    ?? 1,
      angle:      obj.angle      ?? 0,
      selectable: true,
      evented:    true,
    };

    if (obj.type === 'textbox') {
      fabObj = new fabric.Textbox(obj.text ?? 'Text', {
        ...base,
        width,
        fontSize:   obj.fontSize   ?? 24,
        fontWeight: obj.fontWeight ?? 'normal',
        fontFamily: obj.fontFamily ?? 'Inter, Arial, sans-serif',
        textAlign:  obj.textAlign  ?? 'left',
        objectCaching: false,
      });
    } else if (obj.type === 'rect') {
      fabObj = new fabric.Rect({
        ...base,
        width,
        height,
        rx: obj.rx ?? 0,
        ry: obj.rx ?? 0,
      });
    } else if (obj.type === 'ellipse') {
      fabObj = new fabric.Ellipse({
        ...base,
        rx: width / 2,
        ry: height / 2,
        width,
        height,
      });
    } else if (obj.type === 'line') {
      fabObj = new fabric.Line([left, top, left + width, top + height], {
        stroke: obj.fill ?? '#000',
        strokeWidth: 2,
        selectable: true,
        evented: true,
        opacity: obj.opacity ?? 1,
      });
    }

    if (fabObj) {
      fabObj.__id   = generateId();
      fabObj.__name = `${obj.type}_${created.length + 1}`;
      canvas.add(fabObj);
      created.push(fabObj);
    }
  }

  canvas.renderAll();
  const { setLayers } = useEditorStore.getState();
  setLayers(syncLayersFromCanvas(canvas));

  // Save to history
  setTimeout(() => {
    const json = JSON.stringify(canvas.toJSON(['__id', '__name', '__isArtboard']));
    useEditorStore.getState().pushHistory(json);
  }, 50);
}

// ─── Mini preview ─────────────────────────────────────────────────────────────

function TemplateMiniPreview({ template }: { template: Template }) {
  const isLight = !template.bgColors && (template.bgSolid?.includes('#f') || template.bgSolid?.includes('#fff'));
  const textColor = isLight ? template.accent : '#fff';
  const mutedColor = isLight ? '#94a3b8' : 'rgba(255,255,255,0.4)';

  if (template.preview === 'post') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
        <div className="w-2/3 h-2 rounded-full" style={{ background: textColor, opacity: 0.9 }} />
        <div className="w-1/2 h-1 rounded-full mt-1" style={{ background: mutedColor }} />
        <div className="mt-2 w-10 h-2 rounded-full" style={{ background: textColor, opacity: 0.5 }} />
      </div>
    );
  }
  if (template.preview === 'slide') {
    return (
      <div className="w-full h-full flex flex-col justify-center gap-1 p-2">
        <div className="w-1/2 h-2 rounded-full" style={{ background: template.accent, opacity: 0.9 }} />
        <div className="w-3/4 h-1.5 rounded-full mt-1" style={{ background: mutedColor }} />
        <div className="w-2/3 h-1 rounded-full mt-0.5" style={{ background: mutedColor, opacity: 0.6 }} />
        <div className="flex gap-1 mt-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-1 h-4 rounded" style={{ background: `${template.accent}22`, border: `1px solid ${template.accent}33` }} />
          ))}
        </div>
      </div>
    );
  }
  if (template.preview === 'banner') {
    return (
      <div className="w-full h-full flex items-center gap-2 p-2">
        <div className="flex flex-col gap-1 flex-1">
          <div className="h-1.5 rounded-full w-full" style={{ background: template.accent, opacity: 0.9 }} />
          <div className="h-1 rounded-full w-3/4 mt-0.5" style={{ background: mutedColor }} />
        </div>
        <div className="w-8 h-5 rounded" style={{ background: template.accent, opacity: 0.8 }} />
      </div>
    );
  }
  // doc
  return (
    <div className="w-full h-full flex flex-col gap-1 p-2">
      <div className="h-1.5 w-3/4 rounded-full" style={{ background: template.accent, opacity: 0.8 }} />
      <div className="h-1 w-full rounded-full mt-0.5" style={{ background: mutedColor }} />
      <div className="h-1 w-5/6 rounded-full" style={{ background: mutedColor, opacity: 0.7 }} />
      <div className="h-1 w-full rounded-full" style={{ background: mutedColor, opacity: 0.5 }} />
      <div className="h-1 w-4/5 rounded-full" style={{ background: mutedColor, opacity: 0.5 }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TemplatesPanel() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [applying, setApplying] = useState<string | null>(null);

  const filtered = TEMPLATES.filter((t) => {
    const matchesSearch = !search || t.label.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === 'all' || t.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const handleApply = async (template: Template) => {
    setApplying(template.id);
    try {
      await applyTemplate(template);
    } finally {
      setTimeout(() => setApplying(null), 600);
    }
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
            placeholder="Search templates…"
            className="flex-1 bg-transparent outline-none text-xs placeholder:text-gray-600"
            style={{ color: '#d1d5db' }}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-1 px-3 pb-3 flex-wrap shrink-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className="px-2.5 py-1 rounded-full text-xs transition-colors whitespace-nowrap"
            style={{
              background: activeCategory === cat.id ? '#6366f1' : '#1e2535',
              color: activeCategory === cat.id ? '#fff' : '#6b7280',
              border: `1px solid ${activeCategory === cat.id ? '#6366f1' : '#2d3748'}`,
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <span className="text-xs" style={{ color: '#374151' }}>No templates found</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => handleApply(t)}
                className="flex flex-col gap-1.5 text-left group"
                title={`Apply "${t.label}" (${t.width}×${t.height})`}
                disabled={applying === t.id}
              >
                <div
                  className="w-full rounded-lg overflow-hidden relative"
                  style={{
                    height: 72,
                    background: t.bg,
                    border: applying === t.id ? '2px solid #6366f1' : '1.5px solid #2d3748',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    boxShadow: applying === t.id ? '0 0 0 2px rgba(99,102,241,0.3)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (applying !== t.id) {
                      (e.currentTarget as HTMLElement).style.borderColor = '#6366f1';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px rgba(99,102,241,0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (applying !== t.id) {
                      (e.currentTarget as HTMLElement).style.borderColor = '#2d3748';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }
                  }}
                >
                  <TemplateMiniPreview template={t} />
                  {applying === t.id && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'rgba(99,102,241,0.3)', backdropFilter: 'blur(2px)' }}
                    >
                      <Check size={20} style={{ color: '#fff' }} />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 px-0.5">
                  <span className="text-xs truncate" style={{ color: '#c9d1d9' }}>{t.label}</span>
                  <span style={{ fontSize: 10, color: '#4b5563' }}>{t.width}×{t.height}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="px-3 pb-3 pt-1 shrink-0">
        <div
          style={{
            padding: '8px 10px', borderRadius: 6,
            background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)',
            fontSize: 9, color: '#374151', lineHeight: 1.6,
          }}
        >
          Templates load directly into Fabric.js — all objects are fully editable after applying.
        </div>
      </div>
    </div>
  );
}
