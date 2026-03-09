import { useState } from 'react';
import { LayoutTemplate, Shapes, Type, Upload, Sparkles, ChevronLeft, ChevronRight, PenTool, Film } from 'lucide-react';
import { TemplatesPanel } from './panels/TemplatesPanel';
import { ElementsPanel } from './panels/ElementsPanel';
import { TextPanel } from './panels/TextPanel';
import { UploadsPanel } from './panels/UploadsPanel';
import { BrandPanel } from './panels/BrandPanel';
import { TextStylesPanel } from './panels/TextStylesPanel';
import { VideosPanel } from './panels/VideosPanel';

interface LeftSidebarProps {
  onAddShape: (type: 'rect' | 'circle' | 'line' | 'text') => void;
  onAddImage: (file: File) => void;
}

type TabId = 'templates' | 'elements' | 'text' | 'styles' | 'uploads' | 'brand' | 'videos';

const TABS: { id: TabId; Icon: React.ElementType; label: string }[] = [
  { id: 'templates', Icon: LayoutTemplate, label: 'Templates' },
  { id: 'elements', Icon: Shapes, label: 'Elements' },
  { id: 'text', Icon: Type, label: 'Text' },
  { id: 'styles', Icon: PenTool, label: 'Styles' },
  { id: 'uploads', Icon: Upload, label: 'Uploads' },
  { id: 'videos', Icon: Film, label: 'Videos' },
  { id: 'brand', Icon: Sparkles, label: 'Brand' },
];

function IconTab({
  id, Icon, label, active, onClick,
}: {
  id: TabId;
  Icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-xl transition-all relative"
      style={{
        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
        color: active ? '#818cf8' : '#6b7280',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
          (e.currentTarget as HTMLElement).style.color = '#9ca3af';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = '#6b7280';
        }
      }}
    >
      {active && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full"
          style={{ background: '#6366f1' }}
        />
      )}
      <Icon size={18} />
      <span style={{ fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1 }}>
        {label}
      </span>
    </button>
  );
}

export function LeftSidebar({ onAddShape, onAddImage }: LeftSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabId>('elements');
  const [panelOpen, setPanelOpen] = useState(true);

  const handleTabClick = (tabId: TabId) => {
    if (activeTab === tabId) {
      setPanelOpen((p) => !p);
    } else {
      setActiveTab(tabId);
      setPanelOpen(true);
    }
  };

  const activeTabMeta = TABS.find((t) => t.id === activeTab);

  return (
    <aside className="flex h-full shrink-0" style={{ zIndex: 5 }}>
      {/* ── Icon navigation rail ─────────────────────────── */}
      <div
        className="flex flex-col items-center py-2 px-1.5 gap-0.5 shrink-0"
        style={{
          width: 60,
          background: '#161b27',
          borderRight: '1px solid #21283a',
        }}
      >
        {TABS.map(({ id, Icon, label }) => (
          <IconTab
            key={id}
            id={id}
            Icon={Icon}
            label={label}
            active={activeTab === id}
            onClick={() => handleTabClick(id)}
          />
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Collapse toggle */}
        <button
          onClick={() => setPanelOpen((p) => !p)}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
          style={{ color: '#374151' }}
          title={panelOpen ? 'Collapse panel' : 'Expand panel'}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
            (e.currentTarget as HTMLElement).style.color = '#9ca3af';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = '#374151';
          }}
        >
          {panelOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* ── Expandable content panel ─────────────────────── */}
      {panelOpen && (
        <div
          className="flex flex-col shrink-0 overflow-hidden"
          style={{
            width: 268,
            background: '#161b27',
            borderRight: '1px solid #21283a',
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center gap-2.5 px-3 py-3 shrink-0"
            style={{ borderBottom: '1px solid #21283a' }}
          >
            {activeTabMeta && (
              <>
                <activeTabMeta.Icon size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
                <span
                  className="text-xs"
                  style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                >
                  {activeTabMeta.label}
                </span>
              </>
            )}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
            {activeTab === 'templates' && <TemplatesPanel />}
            {activeTab === 'elements' && <ElementsPanel onAddShape={onAddShape} />}
            {activeTab === 'text' && <TextPanel onAddShape={onAddShape} />}
            {activeTab === 'styles' && <TextStylesPanel onAddShape={onAddShape} />}
            {activeTab === 'uploads' && <UploadsPanel onAddImage={onAddImage} />}
            {activeTab === 'videos' && <VideosPanel />}
            {activeTab === 'brand' && <BrandPanel />}
          </div>
        </div>
      )}
    </aside>
  );
}