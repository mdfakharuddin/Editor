import { Type, Minus, Plus } from 'lucide-react';

interface TextPanelProps {
  onAddShape: (type: 'rect' | 'circle' | 'line' | 'text') => void;
}

const TEXT_STYLES = [
  {
    label: 'Heading',
    preview: 'Add a heading',
    fontSize: 22,
    fontWeight: 700,
    description: 'Large, bold title text',
  },
  {
    label: 'Subheading',
    preview: 'Add a subheading',
    fontSize: 16,
    fontWeight: 600,
    description: 'Section header text',
  },
  {
    label: 'Body Text',
    preview: 'Add body text',
    fontSize: 13,
    fontWeight: 400,
    description: 'Paragraph content',
  },
  {
    label: 'Caption',
    preview: 'Add a caption',
    fontSize: 11,
    fontWeight: 400,
    description: 'Small descriptive text',
  },
  {
    label: 'Label',
    preview: 'ADD LABEL',
    fontSize: 10,
    fontWeight: 700,
    description: 'Uppercase label',
    uppercase: true,
  },
];

const FONT_PAIRINGS = [
  { heading: 'Inter', body: 'Inter', tag: 'Modern' },
  { heading: 'Playfair Display', body: 'Georgia', tag: 'Editorial' },
  { heading: 'Trebuchet MS', body: 'Verdana', tag: 'Geometric' },
  { heading: 'Impact', body: 'Arial', tag: 'Bold' },
];

const FONT_FAMILIES = [
  'Inter', 'Arial', 'Georgia', 'Playfair Display',
  'Courier New', 'Verdana', 'Trebuchet MS', 'Impact',
  'Open Sans', 'Roboto', 'Lato', 'Montserrat',
];

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-4 pb-2">
      <span className="text-xs" style={{ color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </span>
    </div>
  );
}

export function TextPanel({ onAddShape }: TextPanelProps) {
  const handleAddText = () => onAddShape('text');

  return (
    <div className="flex flex-col h-full">
      {/* Add text CTA */}
      <div className="p-3 shrink-0">
        <button
          onClick={handleAddText}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all"
          style={{
            background: 'rgba(99,102,241,0.12)',
            border: '1.5px dashed rgba(99,102,241,0.4)',
            color: '#818cf8',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.2)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.6)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.12)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)';
          }}
        >
          <Type size={15} />
          <span className="text-xs">Click to add text</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Text styles */}
        <SectionHeader>Text Styles</SectionHeader>
        <div className="flex flex-col gap-1.5 px-3">
          {TEXT_STYLES.map((style) => (
            <button
              key={style.label}
              onClick={handleAddText}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
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
              <span
                style={{
                  fontSize: Math.max(style.fontSize * 0.65, 9),
                  fontWeight: style.fontWeight,
                  color: '#d1d5db',
                  lineHeight: 1,
                  letterSpacing: style.uppercase ? '0.08em' : undefined,
                  textTransform: style.uppercase ? 'uppercase' : undefined,
                  minWidth: 28,
                  flexShrink: 0,
                }}
              >
                Aa
              </span>
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="text-xs" style={{ color: '#9ca3af' }}>{style.label}</span>
                <span style={{ fontSize: 10, color: '#374151' }}>{style.description}</span>
              </div>
              <span style={{ fontSize: 10, color: '#374151', flexShrink: 0 }}>{style.fontSize}px</span>
            </button>
          ))}
        </div>

        {/* Font pairings */}
        <SectionHeader>Font Pairings</SectionHeader>
        <div className="flex flex-col gap-1.5 px-3">
          {FONT_PAIRINGS.map((pair) => (
            <button
              key={pair.tag}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
              style={{ background: '#1e2535', border: '1px solid #2d3748' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#6366f1';
                (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#2d3748';
                (e.currentTarget as HTMLElement).style.background = '#1e2535';
              }}
              onClick={handleAddText}
            >
              <div className="flex flex-col gap-0.5">
                <span style={{ fontFamily: pair.heading, color: '#d1d5db', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>
                  Heading
                </span>
                <span style={{ fontFamily: pair.body, color: '#6b7280', fontSize: 10, lineHeight: 1 }}>
                  Body text style
                </span>
              </div>
              <div
                className="ml-auto px-2 py-0.5 rounded-full text-xs"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', fontSize: 10 }}
              >
                {pair.tag}
              </div>
            </button>
          ))}
        </div>

        {/* Available fonts */}
        <SectionHeader>Fonts</SectionHeader>
        <div className="px-3 pb-4">
          <div className="flex flex-col gap-1">
            {FONT_FAMILIES.map((font) => (
              <button
                key={font}
                className="flex items-center justify-between px-3 py-2 rounded-lg transition-all"
                style={{ background: 'transparent' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
                onClick={handleAddText}
              >
                <span style={{ fontFamily: font, color: '#9ca3af', fontSize: 13, lineHeight: 1 }}>
                  {font}
                </span>
                <span style={{ fontSize: 10, color: '#374151' }}>Aa</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
