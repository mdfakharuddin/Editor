import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { ToolType, LayerItem } from '../types/editor';

// Using `any` for fabric types to avoid @types/fabric dependency issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricCanvas = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricObject = any;

const HISTORY_LIMIT = 50;

interface EditorState {
  // Core canvas instance
  canvas: FabricCanvas | null;

  // Tool state
  activeTool: ToolType;

  // Selection
  selectedObjects: FabricObject[];

  // Layers (synced from canvas)
  layers: LayerItem[];

  // Viewport
  zoom: number;
  artboardWidth: number;
  artboardHeight: number;

  // History for undo/redo
  history: string[];
  historyIndex: number;
  isHistoryAction: boolean;

  // Cursor position on canvas
  cursorX: number;
  cursorY: number;

  // Actions
  setCanvas: (canvas: FabricCanvas | null) => void;
  setActiveTool: (tool: ToolType) => void;
  setSelectedObjects: (objects: FabricObject[]) => void;
  setLayers: (layers: LayerItem[]) => void;
  setZoom: (zoom: number) => void;
  setArtboardSize: (width: number, height: number) => void;
  setCursorPos: (x: number, y: number) => void;

  // History
  pushHistory: (json: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Object actions (operate on canvas directly)
  deleteSelected: () => void;
  duplicateSelected: () => void;
  selectAll: () => void;

  // Layer ordering
  bringForward: (obj: FabricObject) => void;
  sendBackward: (obj: FabricObject) => void;
  bringToFront: (obj: FabricObject) => void;
  sendToBack: (obj: FabricObject) => void;
  toggleVisibility: (id: string) => void;
  toggleLock: (id: string) => void;
  deleteLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;

  // Export
  exportAs: (format: 'png' | 'jpg' | 'svg') => void;
}

let idCounter = 0;
export const generateId = () => `obj_${Date.now()}_${++idCounter}`;

export const getObjectDefaultName = (type: string): string => {
  const names: Record<string, string> = {
    rect: 'Rectangle',
    circle: 'Circle',
    line: 'Line',
    'i-text': 'Text',
    text: 'Text',
    image: 'Image',
    path: 'Path',
    group: 'Group',
    polygon: 'Polygon',
  };
  return names[type] || 'Object';
};

const syncLayersFromCanvas = (canvas: FabricCanvas): LayerItem[] => {
  if (!canvas) return [];
  const objects = canvas.getObjects() as FabricObject[];
  return objects
    .filter((obj: FabricObject) => !obj.__isArtboard)
    .map((obj: FabricObject) => ({
      id: obj.__id || obj.id || '',
      name: obj.__name || getObjectDefaultName(obj.type),
      type: obj.type || 'object',
      visible: obj.visible !== false,
      locked: !obj.selectable,
      fabricObject: obj,
    }))
    .reverse(); // reverse so top layer is first
};

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
    canvas: null,
    activeTool: 'select',
    selectedObjects: [],
    layers: [],
    zoom: 1,
    artboardWidth: 1200,
    artboardHeight: 800,
    history: [],
    historyIndex: -1,
    isHistoryAction: false,
    cursorX: 0,
    cursorY: 0,

    setCanvas: (canvas) => set({ canvas }),
    setActiveTool: (activeTool) => set({ activeTool }),
    setSelectedObjects: (selectedObjects) => set({ selectedObjects }),
    setLayers: (layers) => set({ layers }),
    setZoom: (zoom) => set({ zoom }),
    setArtboardSize: (artboardWidth, artboardHeight) =>
      set({ artboardWidth, artboardHeight }),
    setCursorPos: (cursorX, cursorY) => set({ cursorX, cursorY }),

    pushHistory: (json) => {
      const { history, historyIndex } = get();
      if (get().isHistoryAction) return;
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(json);
      if (newHistory.length > HISTORY_LIMIT) newHistory.shift();
      set({ history: newHistory, historyIndex: newHistory.length - 1 });
    },

    undo: () => {
      const { canvas, history, historyIndex } = get();
      if (!canvas || historyIndex <= 0) return;
      const newIndex = historyIndex - 1;
      const json = history[newIndex];
      set({ isHistoryAction: true });
      canvas.loadFromJSON(json, () => {
        canvas.renderAll();
        const layers = syncLayersFromCanvas(canvas);
        set({ historyIndex: newIndex, layers, isHistoryAction: false });
      });
    },

    redo: () => {
      const { canvas, history, historyIndex } = get();
      if (!canvas || historyIndex >= history.length - 1) return;
      const newIndex = historyIndex + 1;
      const json = history[newIndex];
      set({ isHistoryAction: true });
      canvas.loadFromJSON(json, () => {
        canvas.renderAll();
        const layers = syncLayersFromCanvas(canvas);
        set({ historyIndex: newIndex, layers, isHistoryAction: false });
      });
    },

    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    deleteSelected: () => {
      const { canvas } = get();
      if (!canvas) return;
      const activeObjects = canvas.getActiveObjects();
      if (!activeObjects.length) return;
      canvas.discardActiveObject();
      activeObjects.forEach((obj: FabricObject) => {
        if (!obj.__isArtboard) canvas.remove(obj);
      });
      canvas.renderAll();
    },

    duplicateSelected: () => {
      const { canvas } = get();
      if (!canvas) return;
      const activeObject = canvas.getActiveObject();
      if (!activeObject || activeObject.__isArtboard) return;
      activeObject.clone((cloned: FabricObject) => {
        cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
        cloned.__id = generateId();
        cloned.__name = `${activeObject.__name || getObjectDefaultName(activeObject.type)} copy`;
        canvas.add(cloned);
        canvas.setActiveObject(cloned);
        canvas.renderAll();
      });
    },

    selectAll: () => {
      const { canvas } = get();
      if (!canvas) return;
      const objects = canvas
        .getObjects()
        .filter((o: FabricObject) => !o.__isArtboard && o.selectable);
      if (!objects.length) return;
      const selection = new (window as any).fabric.ActiveSelection(objects, { canvas });
      canvas.setActiveObject(selection);
      canvas.renderAll();
    },

    bringForward: (obj) => {
      const { canvas } = get();
      if (!canvas || !obj) return;
      canvas.bringForward(obj);
      canvas.renderAll();
      set({ layers: syncLayersFromCanvas(canvas) });
    },

    sendBackward: (obj) => {
      const { canvas } = get();
      if (!canvas || !obj) return;
      // Don't go below the artboard
      const objects = canvas.getObjects();
      const artboardIndex = objects.findIndex((o: FabricObject) => o.__isArtboard);
      const objIndex = objects.indexOf(obj);
      if (objIndex <= artboardIndex + 1) return;
      canvas.sendBackwards(obj);
      canvas.renderAll();
      set({ layers: syncLayersFromCanvas(canvas) });
    },

    bringToFront: (obj) => {
      const { canvas } = get();
      if (!canvas || !obj) return;
      canvas.bringToFront(obj);
      canvas.renderAll();
      set({ layers: syncLayersFromCanvas(canvas) });
    },

    sendToBack: (obj) => {
      const { canvas } = get();
      if (!canvas || !obj) return;
      // Don't go below the artboard
      const artboard = canvas.getObjects().find((o: FabricObject) => o.__isArtboard);
      canvas.sendToBack(obj);
      if (artboard) canvas.sendToBack(artboard);
      canvas.renderAll();
      set({ layers: syncLayersFromCanvas(canvas) });
    },

    toggleVisibility: (id) => {
      const { canvas, layers } = get();
      if (!canvas) return;
      const layer = layers.find((l) => l.id === id);
      if (!layer) return;
      const obj = layer.fabricObject;
      obj.set('visible', !obj.visible);
      canvas.renderAll();
      set({ layers: syncLayersFromCanvas(canvas) });
    },

    toggleLock: (id) => {
      const { canvas, layers } = get();
      if (!canvas) return;
      const layer = layers.find((l) => l.id === id);
      if (!layer) return;
      const obj = layer.fabricObject;
      const isLocked = !obj.selectable;
      obj.set({
        selectable: isLocked,
        evented: isLocked,
        hasControls: isLocked,
      });
      if (!isLocked) canvas.discardActiveObject();
      canvas.renderAll();
      set({ layers: syncLayersFromCanvas(canvas) });
    },

    deleteLayer: (id) => {
      const { canvas, layers } = get();
      if (!canvas) return;
      const layer = layers.find((l) => l.id === id);
      if (!layer) return;
      canvas.remove(layer.fabricObject);
      canvas.renderAll();
    },

    renameLayer: (id, name) => {
      const { layers } = get();
      const layer = layers.find((l) => l.id === id);
      if (!layer) return;
      layer.fabricObject.__name = name;
      set({
        layers: layers.map((l) => (l.id === id ? { ...l, name } : l)),
      });
    },

    exportAs: (format) => {
      const { canvas, artboardWidth, artboardHeight } = get();
      if (!canvas) return;

      const vt = canvas.viewportTransform;
      const zoom = canvas.getZoom();

      // Reset viewport for export
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      canvas.setZoom(1);

      let dataURL = '';
      if (format === 'png') {
        dataURL = canvas.toDataURL({
          format: 'png',
          quality: 1,
          left: 0,
          top: 0,
          width: artboardWidth,
          height: artboardHeight,
        });
      } else if (format === 'jpg') {
        dataURL = canvas.toDataURL({
          format: 'jpeg',
          quality: 0.92,
          left: 0,
          top: 0,
          width: artboardWidth,
          height: artboardHeight,
        });
      } else if (format === 'svg') {
        const svgStr = canvas.toSVG();
        const blob = new Blob([svgStr], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `design.svg`;
        a.click();
        URL.revokeObjectURL(url);
        // Restore viewport
        canvas.setViewportTransform(vt);
        canvas.setZoom(zoom);
        return;
      }

      // Restore viewport
      canvas.setViewportTransform(vt);
      canvas.setZoom(zoom);

      const link = document.createElement('a');
      link.href = dataURL;
      link.download = `design.${format}`;
      link.click();
    },
  }))
);

export { syncLayersFromCanvas };
