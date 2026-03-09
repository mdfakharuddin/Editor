import { useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import {
  useEditorStore,
  generateId,
  getObjectDefaultName,
  syncLayersFromCanvas,
} from '../store/editorStore';
import { syncInitialPageState } from '../store/artboardStore';

const ZOOM_MIN = 0.04;
const ZOOM_MAX = 24;

export function useCanvas(
  canvasElRef: React.RefObject<HTMLCanvasElement>,
  containerRef: React.RefObject<HTMLDivElement>
) {
  const { setCanvas, setSelectedObjects, setLayers, setZoom, pushHistory, setCursorPos, activeTool, artboardWidth, artboardHeight } =
    useEditorStore();

  const fabricRef = useRef<fabric.Canvas | null>(null);
  const isDrawingRef = useRef(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const activeShapeRef = useRef<fabric.Object | null>(null);
  const isPanningRef = useRef(false);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);

  // Refs so event closures always read latest values
  const activeToolRef = useRef(activeTool);
  const artboardWRef = useRef(artboardWidth);
  const artboardHRef = useRef(artboardHeight);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { artboardWRef.current = artboardWidth; }, [artboardWidth]);
  useEffect(() => { artboardHRef.current = artboardHeight; }, [artboardHeight]);

  // ─── Initialize Canvas (once) ─────────────────────────────────────────────
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return;

    // Expose fabric globally so editorStore.selectAll() can use ActiveSelection
    (window as any).fabric = fabric;

    const container = containerRef.current;
    const { width, height } = container.getBoundingClientRect();

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width,
      height,
      backgroundColor: '#0d1117',
      selection: true,
      preserveObjectStacking: true,
      stopContextMenu: true,
      fireRightClick: true,
    });

    fabricRef.current = canvas;

    // ── Artboard (white page background) ──────────────────────────────────
    const artboard = new fabric.Rect({
      left: 0,
      top: 0,
      width: artboardWRef.current,
      height: artboardHRef.current,
      fill: '#ffffff',
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      hoverCursor: 'default',
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 40, offsetX: 0, offsetY: 8 }),
    } as any);
    (artboard as any).__isArtboard = true;
    canvas.add(artboard);

    // ── Initial fit-to-screen ──────────────────────────────────────────────
    const sx = (width * 0.85) / artboardWRef.current;
    const sy = (height * 0.85) / artboardHRef.current;
    const initZoom = Math.min(sx, sy, 1);
    const px = (width - artboardWRef.current * initZoom) / 2;
    const py = (height - artboardHRef.current * initZoom) / 2;
    canvas.setZoom(initZoom);
    canvas.absolutePan(new fabric.Point(-px, -py));
    setZoom(+initZoom.toFixed(2));

    // ── Wheel — zoom & pan ─────────────────────────────────────────────────
    canvas.on('mouse:wheel', (opt) => {
      const e = opt.e as WheelEvent;
      e.preventDefault();
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        let z = canvas.getZoom() * 0.999 ** e.deltaY;
        z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
        canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), z);
        setZoom(+z.toFixed(3));
      } else {
        const vpt = canvas.viewportTransform!;
        vpt[4] -= e.deltaX;
        vpt[5] -= e.deltaY;
        canvas.requestRenderAll();
      }
    });

    // ── Mouse Down ────────────────────────────────────────────────────────
    canvas.on('mouse:down', (opt) => {
      const tool = activeToolRef.current;
      const e = opt.e as MouseEvent;
      const ptr = canvas.getPointer(e);

      // Middle-mouse or Hand tool → pan
      if (e.button === 1 || tool === 'hand') {
        isPanningRef.current = true;
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        canvas.defaultCursor = 'grabbing';
        canvas.selection = false;
        return;
      }

      // Text tool → place IText
      if (tool === 'text') {
        const t = new fabric.IText('Type here...', {
          left: ptr.x,
          top: ptr.y,
          fontSize: 28,
          fill: '#1f2937',
          fontFamily: 'Inter, Arial, sans-serif',
        });
        (t as any).__id = generateId();
        (t as any).__name = 'Text';
        canvas.add(t);
        canvas.setActiveObject(t);
        t.enterEditing();
        t.selectAll();
        canvas.renderAll();
        useEditorStore.getState().setActiveTool('select');
        return;
      }

      // Shape drawing tools
      if (['rect', 'circle', 'line'].includes(tool)) {
        isDrawingRef.current = true;
        drawStartRef.current = { x: ptr.x, y: ptr.y };

        let shape: fabric.Object;
        const base = { stroke: '#6366f1', strokeWidth: 2, selectable: false, evented: false };

        if (tool === 'rect') {
          shape = new fabric.Rect({
            ...base,
            left: ptr.x, top: ptr.y,
            width: 0, height: 0,
            fill: 'rgba(99,102,241,0.12)',
          });
        } else if (tool === 'circle') {
          shape = new fabric.Ellipse({
            ...base,
            left: ptr.x, top: ptr.y,
            rx: 0, ry: 0,
            fill: 'rgba(99,102,241,0.12)',
          });
        } else {
          shape = new fabric.Line([ptr.x, ptr.y, ptr.x, ptr.y], { ...base, fill: '' });
        }

        (shape as any).__isPreview = true;
        canvas.add(shape);
        activeShapeRef.current = shape;
        canvas.renderAll();
      }
    });

    // ── Mouse Move ────────────────────────────────────────────────────────
    canvas.on('mouse:move', (opt) => {
      const e = opt.e as MouseEvent;
      const ptr = canvas.getPointer(e);
      setCursorPos(Math.round(ptr.x), Math.round(ptr.y));

      if (isPanningRef.current && lastPanRef.current) {
        const dx = e.clientX - lastPanRef.current.x;
        const dy = e.clientY - lastPanRef.current.y;
        canvas.relativePan(new fabric.Point(dx, dy));
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      if (isDrawingRef.current && drawStartRef.current && activeShapeRef.current) {
        const { x: sx, y: sy } = drawStartRef.current;
        const shape = activeShapeRef.current;
        const tool = activeToolRef.current;

        if (tool === 'rect') {
          (shape as fabric.Rect).set({
            left: Math.min(ptr.x, sx),
            top: Math.min(ptr.y, sy),
            width: Math.abs(ptr.x - sx),
            height: Math.abs(ptr.y - sy),
          });
        } else if (tool === 'circle') {
          const rx = Math.abs(ptr.x - sx) / 2;
          const ry = Math.abs(ptr.y - sy) / 2;
          (shape as fabric.Ellipse).set({
            left: Math.min(ptr.x, sx),
            top: Math.min(ptr.y, sy),
            rx, ry,
            width: rx * 2,
            height: ry * 2,
          });
        } else if (tool === 'line') {
          (shape as fabric.Line).set({ x2: ptr.x, y2: ptr.y });
        }

        canvas.renderAll();
      }
    });

    // ── Mouse Up ──────────────────────────────────────────────────────────
    canvas.on('mouse:up', () => {
      const tool = activeToolRef.current;

      if (isPanningRef.current) {
        isPanningRef.current = false;
        lastPanRef.current = null;
        canvas.defaultCursor = tool === 'hand' ? 'grab' : 'default';
        if (tool !== 'hand') canvas.selection = true;
        return;
      }

      if (isDrawingRef.current && activeShapeRef.current && drawStartRef.current) {
        isDrawingRef.current = false;
        const shape = activeShapeRef.current;
        activeShapeRef.current = null;

        // Require a minimum size
        let hasSize = false;
        if (tool === 'rect') {
          const r = shape as fabric.Rect;
          hasSize = (r.width || 0) > 5 && (r.height || 0) > 5;
        } else if (tool === 'circle') {
          const el = shape as fabric.Ellipse;
          hasSize = (el.rx || 0) > 2;
        } else if (tool === 'line') {
          const ln = shape as fabric.Line;
          const dx = (ln.x2 || 0) - (ln.x1 || 0);
          const dy = (ln.y2 || 0) - (ln.y1 || 0);
          hasSize = Math.hypot(dx, dy) > 5;
        }

        if (!hasSize) {
          canvas.remove(shape);
          canvas.renderAll();
          return;
        }

        // Finalize
        shape.set({
          selectable: true,
          evented: true,
          fill: tool === 'line' ? '' : '#6366f1',
          stroke: tool !== 'line' ? '' : '#6366f1',
          strokeWidth: tool !== 'line' ? 0 : 2,
        });
        delete (shape as any).__isPreview;
        (shape as any).__id = generateId();
        (shape as any).__name = getObjectDefaultName(shape.type || '');

        canvas.setActiveObject(shape);
        canvas.selection = true;
        canvas.getObjects().forEach((o) => {
          if (!(o as any).__isArtboard && !(o as any).__isPreview) {
            o.selectable = true;
            o.evented = true;
          }
        });
        canvas.renderAll();

        useEditorStore.getState().setActiveTool('select');
        setTimeout(() => {
          const json = JSON.stringify(canvas.toJSON(['__id', '__name', '__isArtboard']));
          useEditorStore.getState().pushHistory(json);
          setLayers(syncLayersFromCanvas(canvas));
        }, 30);
      }
    });

    // ── Selection events ──────────────────────────────────────────────────
    canvas.on('selection:created', () => setSelectedObjects(canvas.getActiveObjects()));
    canvas.on('selection:updated', () => setSelectedObjects(canvas.getActiveObjects()));
    canvas.on('selection:cleared', () => setSelectedObjects([]));

    // ── Object events ─────────────────────────────────────────────────────
    const snap = () => {
      const json = JSON.stringify(canvas.toJSON(['__id', '__name', '__isArtboard']));
      useEditorStore.getState().pushHistory(json);
      setLayers(syncLayersFromCanvas(canvas));
    };
    canvas.on('object:modified', snap);
    canvas.on('object:added', () => setLayers(syncLayersFromCanvas(canvas)));
    canvas.on('object:removed', () => setLayers(syncLayersFromCanvas(canvas)));

    // ── Resize observer ────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const { width: w, height: h } = containerRef.current.getBoundingClientRect();
      canvas.setWidth(w);
      canvas.setHeight(h);
      canvas.renderAll();
    });
    ro.observe(container);

    setCanvas(canvas);

    // Push initial snapshot
    setTimeout(() => {
      const json = JSON.stringify(canvas.toJSON(['__id', '__name', '__isArtboard']));
      useEditorStore.getState().pushHistory(json);
      setLayers(syncLayersFromCanvas(canvas));
      // Sync initial page state into the artboard store
      syncInitialPageState();
    }, 120);

    // ── Artboard resize event ──────────────────────────────────────────────
    const handleArtboardResize = (e: Event) => {
      const { width, height } = (e as CustomEvent).detail as { width: number; height: number };
      const artboard = canvas.getObjects().find((o: any) => (o as any).__isArtboard);
      if (artboard) {
        artboard.set({ width, height });
        canvas.renderAll();
      }
      // Re-fit
      const cw = canvas.getWidth(), ch = canvas.getHeight();
      const z = Math.min((cw * 0.85) / width, (ch * 0.85) / height);
      canvas.setZoom(z);
      canvas.absolutePan(new fabric.Point(-(cw - width * z) / 2, -(ch - height * z) / 2));
      useEditorStore.getState().setZoom(+z.toFixed(3));
    };
    window.addEventListener('editor:resizeArtboard', handleArtboardResize);

    return () => {
      ro.disconnect();
      window.removeEventListener('editor:resizeArtboard', handleArtboardResize);
      canvas.dispose();
      setCanvas(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Sync tool → canvas cursor/selection ──────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.discardActiveObject();

    const allObjs = canvas.getObjects();

    if (activeTool === 'select') {
      canvas.selection = true;
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
      allObjs.forEach((o) => {
        if (!(o as any).__isArtboard) { o.selectable = true; o.evented = true; }
      });
    } else if (activeTool === 'hand') {
      canvas.selection = false;
      canvas.defaultCursor = 'grab';
      canvas.hoverCursor = 'grab';
      allObjs.forEach((o) => { o.selectable = false; o.evented = false; });
    } else {
      canvas.selection = false;
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
      allObjs.forEach((o) => { o.selectable = false; o.evented = false; });
    }
    canvas.renderAll();
  }, [activeTool]);

  // ─── Zoom helpers ─────────────────────────────────────────────────────────
  const zoomIn = useCallback(() => {
    const c = fabricRef.current; if (!c) return;
    const z = Math.min(c.getZoom() * 1.25, ZOOM_MAX);
    c.zoomToPoint(new fabric.Point(c.getWidth() / 2, c.getHeight() / 2), z);
    setZoom(+z.toFixed(3));
  }, [setZoom]);

  const zoomOut = useCallback(() => {
    const c = fabricRef.current; if (!c) return;
    const z = Math.max(c.getZoom() / 1.25, ZOOM_MIN);
    c.zoomToPoint(new fabric.Point(c.getWidth() / 2, c.getHeight() / 2), z);
    setZoom(+z.toFixed(3));
  }, [setZoom]);

  const fitToScreen = useCallback(() => {
    const c = fabricRef.current; if (!c) return;
    const w = c.getWidth(), h = c.getHeight();
    const aw = artboardWRef.current, ah = artboardHRef.current;
    const z = Math.min((w * 0.85) / aw, (h * 0.85) / ah);
    c.setZoom(z);
    c.absolutePan(new fabric.Point(-(w - aw * z) / 2, -(h - ah * z) / 2));
    setZoom(+z.toFixed(3));
  }, [setZoom]);

  const resetZoom = useCallback(() => {
    const c = fabricRef.current; if (!c) return;
    const w = c.getWidth(), h = c.getHeight();
    const aw = artboardWRef.current, ah = artboardHRef.current;
    c.setZoom(1);
    c.absolutePan(new fabric.Point(-(w - aw) / 2, -(h - ah) / 2));
    setZoom(1);
  }, [setZoom]);

  // ─── Add image from file ──────────────────────────────────────────────────
  const addImage = useCallback((file: File) => {
    const c = fabricRef.current; if (!c) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      fabric.Image.fromURL(url, (img) => {
        const aw = artboardWRef.current, ah = artboardHRef.current;
        const scale = Math.min((aw * 0.7) / (img.width || 1), (ah * 0.7) / (img.height || 1), 1);
        img.scale(scale);
        img.set({ left: aw / 2, top: ah / 2, originX: 'center', originY: 'center' });
        (img as any).__id = generateId();
        (img as any).__name = 'Image';
        c.add(img);
        c.setActiveObject(img);
        c.renderAll();
        setTimeout(() => {
          useEditorStore.getState().pushHistory(JSON.stringify(c.toJSON(['__id', '__name', '__isArtboard'])));
          setLayers(syncLayersFromCanvas(c));
        }, 40);
      });
    };
    reader.readAsDataURL(file);
  }, [setLayers]);

  // ─── Quick-add shapes at center ───────────────────────────────────────────
  const addShape = useCallback((type: 'rect' | 'circle' | 'line' | 'text') => {
    const c = fabricRef.current; if (!c) return;
    const aw = artboardWRef.current, ah = artboardHRef.current;
    const cx = aw / 2, cy = ah / 2;

    let shape: fabric.Object;
    if (type === 'rect') {
      shape = new fabric.Rect({ left: cx - 75, top: cy - 50, width: 150, height: 100, fill: '#6366f1', rx: 6, ry: 6 });
    } else if (type === 'circle') {
      shape = new fabric.Ellipse({ left: cx - 60, top: cy - 60, rx: 60, ry: 60, fill: '#8b5cf6' });
    } else if (type === 'line') {
      shape = new fabric.Line([cx - 80, cy, cx + 80, cy], { stroke: '#374151', strokeWidth: 3 });
    } else {
      shape = new fabric.IText('Double-click to edit', {
        left: cx, top: cy, originX: 'center', originY: 'center',
        fontSize: 28, fill: '#1f2937', fontFamily: 'Inter, Arial, sans-serif',
      });
    }

    (shape as any).__id = generateId();
    (shape as any).__name = getObjectDefaultName(shape.type || '');
    c.add(shape);
    c.setActiveObject(shape);
    c.renderAll();

    setTimeout(() => {
      useEditorStore.getState().pushHistory(JSON.stringify(c.toJSON(['__id', '__name', '__isArtboard'])));
      setLayers(syncLayersFromCanvas(c));
    }, 40);
  }, [setLayers]);

  return { zoomIn, zoomOut, fitToScreen, resetZoom, addImage, addShape };
}