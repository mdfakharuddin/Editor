import { useState } from 'react';
import { Sparkles, Plus, Check, Palette, Type, Image as ImageIcon, ChevronRight } from 'lucide-react';

const BRAND_COLORS = [
  { name: 'Primary', hex: '#6366f1', label: 'Indigo' },
  { name: 'Secondary', hex: '#8b5cf6', label: 'Purple' },
  { name: 'Accent', hex: '#06b6d4', label: 'Cyan' },
  { name: 'Success', hex: '#22c55e', label: 'Green' },
  { name: 'Warning', hex: '#f59e0b', label: 'Amber' },
  { name: 'Danger', hex: '#ef4444', label: 'Red' },
  { name: 'Dark', hex: '#0f172a', label: 'Slate 950' },
  { name: 'Light', hex: '#f8fafc', label: 'Slate 50' },
];

const BRAND_FONTS = [
  { role: 'Display', family: 'Playfair Display', weight: 700, sample: 'Brand Heading' },
  { role: 'Body', family: 'Inter', weight: 400, sample: 'Regular body text for content areas and descriptions.' },
  { role: 'Mono', family: 'Courier New', weight: 400, sample: 'Code & technical copy' },
];

const BRAND_LOGOS = [
  { name: 'Primary Logo', type: 'svg' },
  { name: 'Icon Mark', type: 'svg' },
  { name: 'Wordmark', type: 'svg' },
];

function SectionHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pt-4 pb-2">
      <span className="text-xs" style={{ color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </span>
      {action}
    </div>
  );
}

export function BrandPanel() {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const copyHex = (hex: string) => {
    navigator.clipboard.writeText(hex).catch(() => {});
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 1500);
  };

  const applyColor = (hex: string) => {
    const canvas = (window as any).__fabricCanvas;
    if (!canvas) {
      copyHex(hex);
      return;
    }
    const obj = canvas.getActiveObject();
    if (obj) {
      obj.set('fill', hex);
      canvas.requestRenderAll();
    } else {
      copyHex(hex);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header Banner */}
      <div
        className="mx-3 mt-3 rounded-xl p-4 flex flex-col gap-2"
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))', border: '1px solid rgba(99,102,241,0.2)' }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: '#818cf8' }} />
          <span className="text-xs" style={{ color: '#e2e8f0' }}>Brand Kit</span>
        </div>
        <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
          Keep your designs on-brand with your color palette, typography, and logo assets.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Brand Colors */}
        <SectionHeader action={
          <button
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors"
            style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
          >
            <Plus size={10} /> Add
          </button>
        }>
          Colors
        </SectionHeader>
        <div className="grid grid-cols-4 gap-2 px-3">
          {BRAND_COLORS.map((color) => (
            <button
              key={color.hex}
              onClick={() => applyColor(color.hex)}
              className="flex flex-col items-center gap-1.5 group"
              title={`${color.name}: ${color.hex}`}
            >
              <div
                className="w-full aspect-square rounded-xl relative overflow-hidden transition-all"
                style={{
                  background: color.hex,
                  border: '2px solid transparent',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.border = '2px solid rgba(255,255,255,0.4)';
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.border = '2px solid transparent';
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }}
              >
                {copiedHex === color.hex && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <Check size={14} color="white" />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-0">
                <span style={{ fontSize: 9, color: '#9ca3af', lineHeight: 1.2 }}>{color.name}</span>
                <span style={{ fontSize: 9, color: '#4b5563', fontFamily: 'monospace' }}>{color.hex}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Brand Typography */}
        <SectionHeader action={
          <button
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
            style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
          >
            <Plus size={10} /> Add
          </button>
        }>
          Typography
        </SectionHeader>
        <div className="flex flex-col gap-2 px-3">
          {BRAND_FONTS.map((font) => (
            <div
              key={font.role}
              className="p-3 rounded-xl"
              style={{ background: '#1e2535', border: '1px solid #2d3748' }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Type size={11} style={{ color: '#6366f1' }} />
                  <span style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {font.role}
                  </span>
                </div>
                <span style={{ fontSize: 9, color: '#374151' }}>{font.family}</span>
              </div>
              <p
                style={{
                  fontFamily: font.family,
                  fontWeight: font.weight,
                  color: '#d1d5db',
                  fontSize: font.role === 'Display' ? 15 : font.role === 'Mono' ? 11 : 12,
                  lineHeight: 1.4,
                  margin: 0,
                }}
              >
                {font.sample}
              </p>
            </div>
          ))}
        </div>

        {/* Brand Logos */}
        <SectionHeader action={
          <button
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
            style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
          >
            <Plus size={10} /> Upload
          </button>
        }>
          Logos & Assets
        </SectionHeader>
        <div className="flex flex-col gap-1.5 px-3">
          {BRAND_LOGOS.map((logo) => (
            <div
              key={logo.name}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
              style={{ background: '#1e2535', border: '1px solid #2d3748' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(99,102,241,0.1)' }}
              >
                <ImageIcon size={14} style={{ color: '#818cf8' }} />
              </div>
              <div className="flex flex-col gap-0.5 flex-1">
                <span className="text-xs" style={{ color: '#9ca3af' }}>{logo.name}</span>
                <span style={{ fontSize: 10, color: '#374151' }}>{logo.type.toUpperCase()}</span>
              </div>
              <button
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.2)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.1)';
                }}
              >
                Use
              </button>
            </div>
          ))}
        </div>

        {/* Brand Guidelines */}
        <div className="px-3 pt-4 pb-4">
          <button
            className="w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #21283a' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
            }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={13} style={{ color: '#8b5cf6' }} />
              <span className="text-xs" style={{ color: '#9ca3af' }}>Brand Guidelines</span>
            </div>
            <ChevronRight size={12} style={{ color: '#4b5563' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
