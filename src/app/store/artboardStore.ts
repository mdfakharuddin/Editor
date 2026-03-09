/**
 * artboardStore — Multi-page artboard state management
 *
 * Architecture overview:
 * ─────────────────────
 * • Each "page" is a full snapshot of a Fabric.js canvas (serialized JSON +
 *   thumbnail data-URL). The single canvas instance is reused across pages —
 *   switching a page saves the current JSON, clears the canvas, then loads the
 *   new page JSON. This keeps memory usage constant regardless of page count.
 *
 * • Object grouping per artboard: objects implicitly belong to the page they
 *   were created on because each page stores its own complete canvas JSON.
 *   No explicit __pageId tag is needed.
 *
 * • Rendering performance:
 *   – canvas.renderOnAddRemove is set to false during bulk JSON loads.
 *   – Thumbnails use a low-res JPEG (multiplier ~0.15) generated only on page
 *     switch, not on every render.
 *   – requestRenderAll() is preferred over renderAll() for batched repaints.
 *
 * • Dragging objects between artboards: implemented via moveObjectsToPage(),
 *   which serialises the selected fabric objects, removes them from the
 *   current canvas, injects their JSON into the target page snapshot, and
 *   restores the current page (without the moved objects). No page switch is
 *   required — the objects will appear when the user navigates to that page.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { ArtboardPage } from '../types/editor';
import { useEditorStore, syncLayersFromCanvas } from './editorStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _pageCounter = 0;
const nextPageId = () => `page_${Date.now()}_${++_pageCounter}`;

function makeBlankPage(index: number, overrides?: Partial<ArtboardPage>): ArtboardPage {
  return {
    id: nextPageId(),
    name: `Page ${index}`,
    width: 1200,
    height: 800,
    backgroundColor: '#ffffff',
    fabricJSON: null,
    thumbnail: null,
    ...overrides,
  };
}

/**
 * Captures a low-resolution thumbnail of the artboard area.
 * Temporarily resets the viewport so the export covers exactly the artboard,
 * then restores the previous viewport.
 */
function captureThumbnail(canvas: any, page: ArtboardPage): string | null {
  try {
    const prevVT = [...canvas.viewportTransform] as number[];
    const prevZoom = canvas.getZoom();

    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.setZoom(1);

    const scale = Math.min(200 / page.width, 130 / page.height);
    const dataURL = canvas.toDataURL({
      format: 'jpeg',
      quality: 0.45,
      left: 0,
      top: 0,
      width: page.width,
      height: page.height,
      multiplier: scale,
    });

    canvas.setViewportTransform(prevVT);
    canvas.setZoom(prevZoom);
    canvas.requestRenderAll();

    return dataURL;
  } catch {
    return null;
  }
}

/**
 * Loads a page onto the Fabric.js canvas.
 * If the page has stored JSON it is deserialized; otherwise a blank artboard
 * rect is created. After loading the canvas is fitted to the artboard bounds.
 */
function loadPageOnCanvas(page: ArtboardPage): void {
  const editorStore = useEditorStore.getState();
  const canvas = editorStore.canvas;
  if (!canvas) return;

  const fabric = (window as any).fabric;
  if (!fabric) return;

  // Update artboard size in the editor store (drives the HUD dimensions)
  editorStore.setArtboardSize(page.width, page.height);

  const afterLoad = () => {
    // Re-attach non-serialisable artboard flags & ensure it stays at bottom
    const artboard = canvas.getObjects().find((o: any) => o.__isArtboard);
    if (artboard) {
      artboard.set({
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        hoverCursor: 'default',
        width: page.width,
        height: page.height,
        fill: page.backgroundColor,
      });
      canvas.sendToBack(artboard);
    }

    canvas.renderAll();
    editorStore.setLayers(syncLayersFromCanvas(canvas));
    fitCanvasToPage(canvas, page);
  };

  if (page.fabricJSON) {
    canvas.loadFromJSON(page.fabricJSON, afterLoad);
  } else {
    canvas.clear();
    canvas.backgroundColor = '#0d1117';

    const artboard = new fabric.Rect({
      left: 0,
      top: 0,
      width: page.width,
      height: page.height,
      fill: page.backgroundColor,
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      hoverCursor: 'default',
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 40, offsetX: 0, offsetY: 8 }),
    });
    (artboard as any).__isArtboard = true;
    canvas.add(artboard);

    afterLoad();
  }
}

function fitCanvasToPage(canvas: any, page: ArtboardPage): void {
  const fabric = (window as any).fabric;
  if (!fabric) return;

  const w = canvas.getWidth();
  const h = canvas.getHeight();
  const z = Math.min((w * 0.85) / page.width, (h * 0.85) / page.height, 1);
  canvas.setZoom(z);
  canvas.absolutePan(
    new fabric.Point(-(w - page.width * z) / 2, -(h - page.height * z) / 2)
  );
  useEditorStore.getState().setZoom(+z.toFixed(3));
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ArtboardState {
  pages: ArtboardPage[];
  activePageId: string;

  // Queries
  getActivePage: () => ArtboardPage | undefined;

  // CRUD
  addPage: (preset?: Partial<Pick<ArtboardPage, 'width' | 'height' | 'name' | 'backgroundColor'>>) => void;
  deletePage: (id: string) => void;
  duplicatePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;

  // Navigation
  setActivePage: (id: string) => void;

  // Artboard properties
  updatePageBackground: (id: string, color: string) => void;
  updatePageSize: (id: string, width: number, height: number) => void;

  // Ordering
  reorderPages: (fromIndex: number, toIndex: number) => void;

  // State persistence
  saveCurrentPageState: () => void;

  // Cross-page object transfer
  moveObjectsToPage: (targetPageId: string) => void;
}

const _initial = makeBlankPage(1);

export const useArtboardStore = create<ArtboardState>()(
  subscribeWithSelector((set, get) => ({
    pages: [_initial],
    activePageId: _initial.id,

    // ── Queries ─────────────────────────────────────────────────────────────
    getActivePage: () => {
      const { pages, activePageId } = get();
      return pages.find((p) => p.id === activePageId);
    },

    // ── CRUD ────────────────────────────────────────────────────────────────
    addPage: (preset) => {
      const idx = get().pages.length + 1;
      const newPage = makeBlankPage(idx, preset);

      get().saveCurrentPageState();

      set((state) => ({ pages: [...state.pages, newPage], activePageId: newPage.id }));
      loadPageOnCanvas(newPage);
    },

    deletePage: (id) => {
      const { pages, activePageId } = get();
      if (pages.length <= 1) return; // always keep at least one page

      const idx = pages.findIndex((p) => p.id === id);
      const remaining = pages.filter((p) => p.id !== id);

      // If deleting the active page, switch to the adjacent one first
      if (activePageId === id) {
        const newActiveId = remaining[Math.max(0, idx - 1)].id;
        const newActivePage = remaining.find((p) => p.id === newActiveId)!;
        set({ pages: remaining, activePageId: newActiveId });
        loadPageOnCanvas(newActivePage);
      } else {
        set({ pages: remaining });
      }
    },

    duplicatePage: (id) => {
      const { pages, activePageId } = get();
      const src = pages.find((p) => p.id === id);
      if (!src) return;

      // Ensure the source page has current state
      if (id === activePageId) get().saveCurrentPageState();

      // Re-read after possible save
      const fresh = get().pages.find((p) => p.id === id)!;
      const dup: ArtboardPage = {
        ...fresh,
        id: nextPageId(),
        name: `${fresh.name} (copy)`,
        thumbnail: null,
      };

      const srcIdx = get().pages.findIndex((p) => p.id === id);
      const newPages = [...get().pages];
      newPages.splice(srcIdx + 1, 0, dup);

      // Save current page, then switch to duplicate
      get().saveCurrentPageState();
      set({ pages: newPages, activePageId: dup.id });
      loadPageOnCanvas(dup);
    },

    renamePage: (id, name) => {
      set((state) => ({
        pages: state.pages.map((p) => (p.id === id ? { ...p, name } : p)),
      }));
    },

    // ── Navigation ──────────────────────────────────────────────────────────
    setActivePage: (id) => {
      const { activePageId, pages } = get();
      if (id === activePageId) return;

      // 1. Save current page (JSON + thumbnail)
      get().saveCurrentPageState();

      // 2. Switch store state
      set({ activePageId: id });

      // 3. Load new page onto canvas
      const newPage = pages.find((p) => p.id === id);
      if (newPage) loadPageOnCanvas(newPage);
    },

    // ── Artboard properties ─────────────────────────────────────────────────
    updatePageBackground: (id, backgroundColor) => {
      set((state) => ({
        pages: state.pages.map((p) => (p.id === id ? { ...p, backgroundColor } : p)),
      }));

      // If it's the active page, update the artboard rect live
      if (id === get().activePageId) {
        const canvas = useEditorStore.getState().canvas;
        if (canvas) {
          const ab = canvas.getObjects().find((o: any) => o.__isArtboard);
          if (ab) { ab.set('fill', backgroundColor); canvas.requestRenderAll(); }
        }
      }
    },

    updatePageSize: (id, width, height) => {
      set((state) => ({
        pages: state.pages.map((p) => (p.id === id ? { ...p, width, height } : p)),
      }));

      if (id === get().activePageId) {
        useEditorStore.getState().setArtboardSize(width, height);
        window.dispatchEvent(new CustomEvent('editor:resizeArtboard', { detail: { width, height } }));
      }
    },

    // ── Ordering ────────────────────────────────────────────────────────────
    reorderPages: (fromIndex, toIndex) => {
      set((state) => {
        const pages = [...state.pages];
        const [moved] = pages.splice(fromIndex, 1);
        pages.splice(toIndex, 0, moved);
        return { pages };
      });
    },

    // ── State persistence ────────────────────────────────────────────────────
    /**
     * Serialises the current canvas and generates a thumbnail, storing both
     * into the active page's slot. Called automatically before any page switch.
     */
    saveCurrentPageState: () => {
      const canvas = useEditorStore.getState().canvas;
      if (!canvas) return;

      const { activePageId } = get();
      const activePage = get().pages.find((p) => p.id === activePageId);
      if (!activePage) return;

      const thumbnail = captureThumbnail(canvas, activePage);
      const json = JSON.stringify(
        canvas.toJSON(['__id', '__name', '__isArtboard'])
      );

      set((state) => ({
        pages: state.pages.map((p) =>
          p.id === activePageId ? { ...p, fabricJSON: json, thumbnail } : p
        ),
      }));
    },

    // ── Cross-page object transfer ────────────────────────────────────────────
    /**
     * Moves the currently selected canvas objects to another page.
     *
     * Implementation:
     *  1. Serialise selected objects.
     *  2. Remove them from the current canvas.
     *  3. Save the now-lighter current page state.
     *  4. Inject the serialised objects into the target page's stored JSON.
     *
     * The user stays on the current page; the moved objects will appear on the
     * target page when navigated to.
     */
    moveObjectsToPage: (targetPageId) => {
      const canvas = useEditorStore.getState().canvas;
      if (!canvas) return;

      const activeObjs = canvas.getActiveObjects().filter((o: any) => !o.__isArtboard);
      if (!activeObjs.length) return;

      // Serialise
      const objectsData = activeObjs.map((o: any) =>
        o.toObject(['__id', '__name'])
      );

      // Remove from current canvas
      canvas.discardActiveObject();
      activeObjs.forEach((o: any) => canvas.remove(o));
      canvas.requestRenderAll();

      // Save current page (without the moved objects)
      get().saveCurrentPageState();

      // Inject into target page JSON
      const targetPage = get().pages.find((p) => p.id === targetPageId);
      if (targetPage) {
        let parsed: any = { objects: [], background: targetPage.backgroundColor };
        if (targetPage.fabricJSON) {
          try { parsed = JSON.parse(targetPage.fabricJSON); } catch { /* noop */ }
        }
        parsed.objects = [...(parsed.objects ?? []), ...objectsData];

        set((state) => ({
          pages: state.pages.map((p) =>
            p.id === targetPageId ? { ...p, fabricJSON: JSON.stringify(parsed) } : p
          ),
        }));
      }

      // Sync layer panel
      useEditorStore.getState().setLayers(syncLayersFromCanvas(canvas));
    },
  }))
);

/** Registers the initial page state after the canvas is fully initialised. */
export function syncInitialPageState(): void {
  setTimeout(() => {
    useArtboardStore.getState().saveCurrentPageState();
  }, 150);
}
