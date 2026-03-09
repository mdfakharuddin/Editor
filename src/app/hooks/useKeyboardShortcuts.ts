import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

export function useKeyboardShortcuts() {
  const {
    canvas,
    deleteSelected,
    duplicateSelected,
    selectAll,
    undo,
    redo,
    canUndo,
    canRedo,
    setActiveTool,
    activeTool,
  } = useEditorStore();

  useEffect(() => {
    if (!canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMeta = e.metaKey || e.ctrlKey;

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Check if any text object is in edit mode
        const activeObj = canvas.getActiveObject();
        if (activeObj && activeObj.isEditing) return;
        e.preventDefault();
        deleteSelected();
        return;
      }

      // Ctrl/Cmd + Z — Undo
      if (isMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) undo();
        return;
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y — Redo
      if ((isMeta && e.shiftKey && e.key === 'z') || (isMeta && e.key === 'y')) {
        e.preventDefault();
        if (canRedo()) redo();
        return;
      }

      // Ctrl/Cmd + D — Duplicate
      if (isMeta && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      // Ctrl/Cmd + A — Select all
      if (isMeta && e.key === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }

      // Escape — switch to select tool / deselect
      if (e.key === 'Escape') {
        setActiveTool('select');
        canvas.discardActiveObject();
        canvas.renderAll();
        return;
      }

      // V — Select tool
      if (e.key === 'v' && !isMeta) {
        setActiveTool('select');
        return;
      }

      // H — Hand tool
      if (e.key === 'h' && !isMeta) {
        setActiveTool('hand');
        return;
      }

      // R — Rectangle
      if (e.key === 'r' && !isMeta) {
        setActiveTool('rect');
        return;
      }

      // C — Circle
      if (e.key === 'c' && !isMeta) {
        setActiveTool('circle');
        return;
      }

      // L — Line
      if (e.key === 'l' && !isMeta) {
        setActiveTool('line');
        return;
      }

      // T — Text
      if (e.key === 't' && !isMeta) {
        setActiveTool('text');
        return;
      }

      // Arrow key nudging
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const activeObj = canvas.getActiveObject();
        if (!activeObj || activeObj.isEditing) return;
        e.preventDefault();
        const nudge = e.shiftKey ? 10 : 1;
        const delta = {
          ArrowUp: { top: -nudge },
          ArrowDown: { top: nudge },
          ArrowLeft: { left: -nudge },
          ArrowRight: { left: nudge },
        }[e.key]!;
        activeObj.set(delta);
        canvas.renderAll();
        return;
      }

      // Ctrl/Cmd + [ — Send backward
      if (isMeta && e.key === '[') {
        e.preventDefault();
        const activeObj = canvas.getActiveObject();
        if (activeObj) useEditorStore.getState().sendBackward(activeObj);
        return;
      }

      // Ctrl/Cmd + ] — Bring forward
      if (isMeta && e.key === ']') {
        e.preventDefault();
        const activeObj = canvas.getActiveObject();
        if (activeObj) useEditorStore.getState().bringForward(activeObj);
        return;
      }

      // F — Fit to screen
      if (e.key === 'f' && !isMeta) {
        window.dispatchEvent(new CustomEvent('editor:fitScreen'));
        return;
      }

      // 1 — Reset zoom to 100%
      if (e.key === '1' && !isMeta) {
        window.dispatchEvent(new CustomEvent('editor:resetZoom'));
        return;
      }

      // + or = — Zoom in
      if ((e.key === '+' || e.key === '=') && !isMeta) {
        window.dispatchEvent(new CustomEvent('editor:zoomIn'));
        return;
      }

      // - — Zoom out
      if (e.key === '-' && !isMeta) {
        window.dispatchEvent(new CustomEvent('editor:zoomOut'));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canvas,
    activeTool,
    deleteSelected,
    duplicateSelected,
    selectAll,
    undo,
    redo,
    canUndo,
    canRedo,
    setActiveTool,
  ]);
}