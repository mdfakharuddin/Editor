import { useRef, useEffect, useState, useCallback } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useEditorStore } from '../../store/editorStore';
import { useArtboardStore } from '../../store/artboardStore';
import { ContextMenu } from './ContextMenu';
import {
  ZoomIn, ZoomOut, Maximize2, RotateCcw, Move, Grid,
  Crosshair, FileText,
} from 'lucide-react';

interface ContextMenuState {
  clientX: number;
  clientY: number;
}

export function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const { zoom, cursorX, cursorY, artboardWidth, artboardHeight, canvas, selectedObjects } = useEditorStore();
  const { pages, activePageId } = useArtboardStore();
  const activePage = pages.find((p) => p.id === activePageId);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const { zoomIn, zoomOut, fitToScreen, resetZoom, addImage, addShape } = useCanvas(
    canvasElRef as React.RefObject<HTMLCanvasElement>,
    containerRef as React.RefObject<HTMLDivElement>
  );

  useKeyboardShortcuts();

  // ── Wire up editor:addShape and editor:addImage custom events ────────────
  useEffect(() => {
    const handleAddShape = (e: Event) => {
      const { type } = (e as CustomEvent).detail as { type: 'rect' | 'circle' | 'line' | 'text' };
      addShape(type);
    };
    const handleAddImage = (e: Event) => {
      const { file } = (e as CustomEvent).detail as { file: File };
      addImage(file);
    };
    const handleFitScreen = () => fitToScreen();
    const handleResetZoom = () => resetZoom();
    const handleZoomIn = () => zoomIn();
    const handleZoomOut = () => zoomOut();

    window.addEventListener('editor:addShape', handleAddShape);
    window.addEventListener('editor:addImage', handleAddImage);
    window.addEventListener('editor:fitScreen', handleFitScreen);
    window.addEventListener('editor:resetZoom', handleResetZoom);
    window.addEventListener('editor:zoomIn', handleZoomIn);
    window.addEventListener('editor:zoomOut', handleZoomOut);
    return () => {
      window.removeEventListener('editor:addShape', handleAddShape);
      window.removeEventListener('editor:addImage', handleAddImage);
      window.removeEventListener('editor:fitScreen', handleFitScreen);
      window.removeEventListener('editor:resetZoom', handleResetZoom);
      window.removeEventListener('editor:zoomIn', handleZoomIn);
      window.removeEventListener('editor:zoomOut', handleZoomOut);
    };
  }, [addShape, addImage, fitToScreen, resetZoom, zoomIn, zoomOut]);

  // ── Right-click context menu via fabric mouse:down ───────────────────────
  useEffect(() => {
    if (!canvas) return;
    const handler = (opt: any) => {
      const e = opt.e as MouseEvent;
      if (e.button === 2) {
        e.preventDefault();
        setCtxMenu({ clientX: e.clientX, clientY: e.clientY });
      }
    };
    canvas.on('mouse:down', handler);
    return () => { canvas.off('mouse:down', handler); };
  }, [canvas]);

  // ── Grid overlay toggle ──────────────────────────────────────────────────
  useEffect(() => {
    if (!canvas) return;
    if (showGrid) {
      const gridSize = 20;
      const aw = artboardWidth;
      const ah = artboardHeight;
      const lines: any[] = [];
      const fabric = (window as any).fabric;
      if (!fabric) return;

      for (let x = 0; x <= aw; x += gridSize) {
        const line = new fabric.Line([x, 0, x, ah], {
          stroke: x % 100 === 0 ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
          strokeWidth: x % 100 === 0 ? 1 : 0.5,
          selectable: false, evented: false, excludeFromExport: true,
        });
        (line as any).__isGrid = true;
        lines.push(line);
      }
      for (let y = 0; y <= ah; y += gridSize) {
        const line = new fabric.Line([0, y, aw, y], {
          stroke: y % 100 === 0 ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
          strokeWidth: y % 100 === 0 ? 1 : 0.5,
          selectable: false, evented: false, excludeFromExport: true,
        });
        (line as any).__isGrid = true;
        lines.push(line);
      }

      lines.forEach((l) => canvas.add(l));
      lines.forEach((l) => canvas.sendToBack(l));
      const artboard = canvas.getObjects().find((o: any) => o.__isArtboard);
      if (artboard) canvas.sendToBack(artboard);
      canvas.requestRenderAll();

      return () => {
        canvas.getObjects()
          .filter((o: any) => o.__isGrid)
          .forEach((o: any) => canvas.remove(o));
        canvas.requestRenderAll();
      };
    }
  }, [showGrid, canvas, artboardWidth, artboardHeight]);

  // ── File drag-and-drop onto canvas ───────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if ([...e.dataTransfer.items].some((i) => i.kind === 'file' && i.type.startsWith('image/'))) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => setIsDraggingFile(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (file) addImage(file);
  }, [addImage]);

  const selectedCount = selectedObjects.length;

  return (
    <div
      className="relative flex-1 overflow-hidden flex flex-col"
      style={{ background: '#0d1117' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Canvas workspace ─────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ overflow: 'hidden' }}
      >
        <canvas ref={canvasElRef} />
      </div>

      {/* ── Drag-over overlay ─────────────────────────────────────── */}
      {isDraggingFile && (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 pointer-events-none"
          style={{
            background: 'rgba(99,102,241,0.06)',
            border: '2px dashed rgba(99,102,241,0.5)',
          }}
        >
          <div
            className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl"
            style={{ background: 'rgba(13,17,23,0.85)', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            <Move size={32} style={{ color: '#818cf8' }} />
            <div className="text-center">
              <p className="text-sm" style={{ color: '#e2e8f0' }}>Drop image here</p>
              <p style={{ fontSize: 12, color: '#6b7280' }}>PNG, JPG, SVG, WebP supported</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Top HUD: Artboard label + Grid toggle ─────────────────── */}
      <div
        className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 pointer-events-none"
        style={{ zIndex: 10 }}
      >
        {/* Artboard info */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg pointer-events-auto"
          style={{ background: 'rgba(13,17,23,0.7)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}
        >
          <Crosshair size={11} style={{ color: '#374151' }} />
          {activePage && (
            <>
              <FileText size={10} style={{ color: '#4b5563' }} />
              <span className="text-xs" style={{ color: '#4b5563' }}>
                {activePage.name}
              </span>
              <span style={{ color: '#21283a', fontSize: 10 }}>·</span>
            </>
          )}
          <span className="text-xs" style={{ color: '#4b5563' }}>
            {artboardWidth} × {artboardHeight}
          </span>
          {selectedCount > 0 && (
            <>
              <span style={{ color: '#21283a', fontSize: 10 }}>•</span>
              <span className="text-xs" style={{ color: '#6366f1' }}>
                {selectedCount} selected
              </span>
            </>
          )}
        </div>

        {/* Grid toggle */}
        <button
          onClick={() => setShowGrid((p) => !p)}
          title="Toggle Grid (G)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all pointer-events-auto"
          style={{
            background: showGrid ? 'rgba(99,102,241,0.15)' : 'rgba(13,17,23,0.7)',
            border: showGrid ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)',
            color: showGrid ? '#818cf8' : '#4b5563',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Grid size={12} />
          <span>Grid</span>
        </button>
      </div>

      {/* ── Bottom HUD: Zoom controls + cursor ───────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 pb-3 pt-2 pointer-events-none"
        style={{ zIndex: 10 }}
      >
        {/* Cursor coordinates */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg pointer-events-auto"
          style={{
            background: 'rgba(13,17,23,0.65)',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Move size={10} style={{ color: '#2d3748' }} />
          <span className="text-xs font-mono" style={{ color: '#374151' }}>
            {cursorX}, {cursorY}
          </span>
        </div>

        {/* Zoom pill */}
        <div
          className="flex items-center gap-0.5 rounded-xl px-1.5 py-1 pointer-events-auto"
          style={{
            background: 'rgba(22,27,39,0.9)',
            border: '1px solid #21283a',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <ZoomButton onClick={zoomOut} title="Zoom Out (Ctrl−)">
            <ZoomOut size={13} />
          </ZoomButton>

          <button
            onClick={resetZoom}
            className="px-3 py-1 rounded-lg text-xs transition-colors"
            style={{ color: '#9ca3af', minWidth: 56, textAlign: 'center' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
              (e.currentTarget as HTMLElement).style.color = '#e2e8f0';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#9ca3af';
            }}
            title="Reset to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>

          <ZoomButton onClick={zoomIn} title="Zoom In (Ctrl+)">
            <ZoomIn size={13} />
          </ZoomButton>

          <div style={{ width: 1, height: 16, background: '#21283a', margin: '0 2px' }} />

          <ZoomButton onClick={fitToScreen} title="Fit to Screen (F)">
            <Maximize2 size={12} />
          </ZoomButton>

          <ZoomButton onClick={resetZoom} title="Reset Zoom (1)">
            <RotateCcw size={12} />
          </ZoomButton>
        </div>

        {/* Right spacer placeholder for symmetry */}
        <div style={{ minWidth: 80 }} />
      </div>

      {/* ── Context menu ─────────────────────────────────────────── */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.clientX}
          y={ctxMenu.clientY}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

function ZoomButton({
  onClick, title, children,
}: {
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-lg transition-colors"
      style={{ color: '#6b7280' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLElement).style.color = '#9ca3af';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = '#6b7280';
      }}
    >
      {children}
    </button>
  );
}