import { useState } from 'react';
import { Layers, SlidersHorizontal, Code2, Zap } from 'lucide-react';
import { LayersPanel } from './LayersPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { AnimatePanel } from './panels/AnimatePanel';

type RightTab = 'design' | 'layers' | 'animate' | 'inspect';

const TABS: { id: RightTab; label: string; Icon: React.ElementType }[] = [
  { id: 'design',   label: 'Design',   Icon: SlidersHorizontal },
  { id: 'layers',   label: 'Layers',   Icon: Layers },
  { id: 'animate',  label: 'Animate',  Icon: Zap },
  { id: 'inspect',  label: 'Inspect',  Icon: Code2 },
];

function InspectPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
      <Code2 size={28} style={{ color: '#2d3748' }} />
      <div className="text-center">
        <p className="text-xs mb-1" style={{ color: '#4b5563' }}>
          Inspect mode
        </p>
        <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>
          Select an element to view its CSS properties and code snippets.
        </p>
      </div>
      <div
        className="w-full rounded-lg p-3 font-mono"
        style={{ background: '#1e2535', border: '1px solid #2d3748' }}
      >
        <div style={{ color: '#4b5563', fontSize: 10 }}>/* Select an object */</div>
        <div style={{ color: '#818cf8', fontSize: 10 }}>
          <span style={{ color: '#6b7280' }}>width</span>
          <span style={{ color: '#4b5563' }}>: </span>
          <span>—</span>
        </div>
        <div style={{ color: '#818cf8', fontSize: 10 }}>
          <span style={{ color: '#6b7280' }}>height</span>
          <span style={{ color: '#4b5563' }}>: </span>
          <span>—</span>
        </div>
        <div style={{ color: '#818cf8', fontSize: 10 }}>
          <span style={{ color: '#6b7280' }}>background</span>
          <span style={{ color: '#4b5563' }}>: </span>
          <span>—</span>
        </div>
      </div>
    </div>
  );
}

export function RightSidebar() {
  const [activeTab, setActiveTab] = useState<RightTab>('design');

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{
        width: 264,
        background: '#161b27',
        borderLeft: '1px solid #21283a',
      }}
    >
      {/* Tab header */}
      <div
        className="flex items-center shrink-0"
        style={{ borderBottom: '1px solid #21283a', height: 42 }}
      >
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex-1 h-full flex items-center justify-center gap-1 text-xs transition-colors relative"
            style={{
              color: activeTab === id ? '#e2e8f0' : '#6b7280',
              background: 'transparent',
              fontSize: 10,
            }}
            onMouseEnter={(e) => {
              if (activeTab !== id)
                (e.currentTarget as HTMLElement).style.color = '#9ca3af';
            }}
            onMouseLeave={(e) => {
              if (activeTab !== id)
                (e.currentTarget as HTMLElement).style.color = '#6b7280';
            }}
          >
            <Icon size={11} />
            <span>{label}</span>
            {activeTab === id && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                style={{ background: '#6366f1' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
        {activeTab === 'design'  && <PropertiesPanel />}
        {activeTab === 'layers'  && <LayersPanel />}
        {activeTab === 'animate' && <AnimatePanel />}
        {activeTab === 'inspect' && <InspectPanel />}
      </div>
    </aside>
  );
}
