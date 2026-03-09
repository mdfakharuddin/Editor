import { useEditorStore } from '../../store/editorStore';

type AlignDir = 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom';

function alignObjects(canvas: any, artboardW: number, artboardH: number, dir: AlignDir) {
  const obj = canvas.getActiveObject();
  if (!obj) return;

  if (obj.type === 'activeSelection') {
    const objs: any[] = obj.getObjects();
    const selW = obj.width ?? 0;
    const selH = obj.height ?? 0;

    objs.forEach((child: any) => {
      const childW = (child.width ?? 0) * (child.scaleX ?? 1);
      const childH = (child.height ?? 0) * (child.scaleY ?? 1);
      switch (dir) {
        case 'left':    child.set('left', -(selW / 2)); break;
        case 'centerH': child.set('left', -(childW / 2)); break;
        case 'right':   child.set('left', selW / 2 - childW); break;
        case 'top':     child.set('top', -(selH / 2)); break;
        case 'centerV': child.set('top', -(childH / 2)); break;
        case 'bottom':  child.set('top', selH / 2 - childH); break;
      }
    });
    obj.setCoords();
  } else {
    const w = (obj.width ?? 0) * (obj.scaleX ?? 1);
    const h = (obj.height ?? 0) * (obj.scaleY ?? 1);
    switch (dir) {
      case 'left':    obj.set('left', 0); break;
      case 'centerH': obj.set('left', (artboardW - w) / 2); break;
      case 'right':   obj.set('left', artboardW - w); break;
      case 'top':     obj.set('top', 0); break;
      case 'centerV': obj.set('top', (artboardH - h) / 2); break;
      case 'bottom':  obj.set('top', artboardH - h); break;
    }
  }

  canvas.requestRenderAll();
  setTimeout(() => {
    const json = JSON.stringify(canvas.toJSON(['__id', '__name', '__isArtboard']));
    useEditorStore.getState().pushHistory(json);
  }, 30);
}

function distributeObjects(canvas: any, axis: 'h' | 'v') {
  const sel = canvas.getActiveObject();
  if (!sel || sel.type !== 'activeSelection') return;

  const objs: any[] = [...sel.getObjects()].sort((a, b) =>
    axis === 'h' ? a.left - b.left : a.top - b.top
  );
  if (objs.length < 3) return;

  const first = objs[0];
  const last = objs[objs.length - 1];

  if (axis === 'h') {
    const step = (last.left - first.left) / (objs.length - 1);
    objs.forEach((o, i) => o.set('left', first.left + step * i));
  } else {
    const step = (last.top - first.top) / (objs.length - 1);
    objs.forEach((o, i) => o.set('top', first.top + step * i));
  }

  sel.setCoords();
  canvas.requestRenderAll();
}

// ── SVG icon components ────────────────────────────────────────────────────
const AlignLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="1.5" height="12" rx="0.5" fill="currentColor" opacity={0.5} />
    <rect x="3.5" y="3" width="7" height="3" rx="0.5" fill="currentColor" />
    <rect x="3.5" y="8" width="5" height="3" rx="0.5" fill="currentColor" />
  </svg>
);
const AlignCenterHIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="6.5" y="1" width="1.5" height="12" rx="0.5" fill="currentColor" opacity={0.5} />
    <rect x="2.5" y="3" width="9" height="3" rx="0.5" fill="currentColor" />
    <rect x="3.5" y="8" width="7" height="3" rx="0.5" fill="currentColor" />
  </svg>
);
const AlignRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="11.5" y="1" width="1.5" height="12" rx="0.5" fill="currentColor" opacity={0.5} />
    <rect x="3.5" y="3" width="7" height="3" rx="0.5" fill="currentColor" />
    <rect x="5.5" y="8" width="5" height="3" rx="0.5" fill="currentColor" />
  </svg>
);
const AlignTopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="12" height="1.5" rx="0.5" fill="currentColor" opacity={0.5} />
    <rect x="3" y="3.5" width="3" height="7" rx="0.5" fill="currentColor" />
    <rect x="8" y="3.5" width="3" height="5" rx="0.5" fill="currentColor" />
  </svg>
);
const AlignMiddleVIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="6.5" width="12" height="1.5" rx="0.5" fill="currentColor" opacity={0.5} />
    <rect x="3" y="2.5" width="3" height="9" rx="0.5" fill="currentColor" />
    <rect x="8" y="3.5" width="3" height="7" rx="0.5" fill="currentColor" />
  </svg>
);
const AlignBottomIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="11.5" width="12" height="1.5" rx="0.5" fill="currentColor" opacity={0.5} />
    <rect x="3" y="3.5" width="3" height="7" rx="0.5" fill="currentColor" />
    <rect x="8" y="5.5" width="3" height="5" rx="0.5" fill="currentColor" />
  </svg>
);

const ALIGN_BUTTONS: { dir: AlignDir; icon: React.ReactNode; title: string }[] = [
  { dir: 'left',    icon: <AlignLeftIcon />,    title: 'Align Left' },
  { dir: 'centerH', icon: <AlignCenterHIcon />, title: 'Align Center Horizontally' },
  { dir: 'right',   icon: <AlignRightIcon />,   title: 'Align Right' },
  { dir: 'top',     icon: <AlignTopIcon />,      title: 'Align Top' },
  { dir: 'centerV', icon: <AlignMiddleVIcon />,  title: 'Align Middle Vertically' },
  { dir: 'bottom',  icon: <AlignBottomIcon />,   title: 'Align Bottom' },
];

export function AlignPanel() {
  const { canvas, artboardWidth, artboardHeight, selectedObjects } = useEditorStore();
  const isMulti = selectedObjects.length > 1;

  if (!canvas || selectedObjects.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <span
        className="text-xs"
        style={{ color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}
      >
        {isMulti ? 'Align — Selection' : 'Align — Artboard'}
      </span>

      {/* 6-button alignment grid */}
      <div className="grid grid-cols-6 gap-1">
        {ALIGN_BUTTONS.map(({ dir, icon, title }) => (
          <AlignBtn
            key={dir}
            title={title}
            onClick={() => alignObjects(canvas, artboardWidth, artboardHeight, dir)}
          >
            {icon}
          </AlignBtn>
        ))}
      </div>

      {/* Distribute (3+ objects only) */}
      {isMulti && selectedObjects.length >= 3 && (
        <div className="flex gap-1">
          <DistributeBtn
            title="Distribute Horizontally"
            onClick={() => distributeObjects(canvas, 'h')}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="0.5" y="2" width="1.5" height="8" rx="0.5" fill="currentColor" opacity={0.5} />
              <rect x="10" y="2" width="1.5" height="8" rx="0.5" fill="currentColor" opacity={0.5} />
              <rect x="4.25" y="3" width="3.5" height="6" rx="0.5" fill="currentColor" />
            </svg>
            <span>Distribute H</span>
          </DistributeBtn>
          <DistributeBtn
            title="Distribute Vertically"
            onClick={() => distributeObjects(canvas, 'v')}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2" y="0.5" width="8" height="1.5" rx="0.5" fill="currentColor" opacity={0.5} />
              <rect x="2" y="10" width="8" height="1.5" rx="0.5" fill="currentColor" opacity={0.5} />
              <rect x="3" y="4.25" width="6" height="3.5" rx="0.5" fill="currentColor" />
            </svg>
            <span>Distribute V</span>
          </DistributeBtn>
        </div>
      )}
    </div>
  );
}

function AlignBtn({
  children, onClick, title,
}: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex items-center justify-center rounded transition-all"
      style={{ height: 28, background: '#1e2535', border: '1px solid #2d3748', color: '#9ca3af' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.15)';
        (e.currentTarget as HTMLElement).style.borderColor = '#6366f1';
        (e.currentTarget as HTMLElement).style.color = '#a5b4fc';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = '#1e2535';
        (e.currentTarget as HTMLElement).style.borderColor = '#2d3748';
        (e.currentTarget as HTMLElement).style.color = '#9ca3af';
      }}
    >
      {children}
    </button>
  );
}

function DistributeBtn({
  children, onClick, title,
}: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 rounded text-xs transition-all"
      style={{ height: 26, background: '#1e2535', border: '1px solid #2d3748', color: '#9ca3af' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.15)';
        (e.currentTarget as HTMLElement).style.borderColor = '#6366f1';
        (e.currentTarget as HTMLElement).style.color = '#a5b4fc';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = '#1e2535';
        (e.currentTarget as HTMLElement).style.borderColor = '#2d3748';
        (e.currentTarget as HTMLElement).style.color = '#9ca3af';
      }}
    >
      {children}
    </button>
  );
}
