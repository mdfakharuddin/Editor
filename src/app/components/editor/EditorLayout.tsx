import { useCallback, useState, useEffect } from 'react';
import { Toolbar } from './Toolbar';
import { LeftSidebar } from './LeftSidebar';
import { CanvasArea } from './CanvasArea';
import { RightSidebar } from './RightSidebar';
import { ArtboardsPanel } from './ArtboardsPanel';
import { VideoTimeline } from './VideoTimeline';
import { useVideoRenderer } from '../../hooks/useVideoRenderer';

/**
 * EditorLayout
 *
 * Full layout tree:
 * ─────────────────
 * <Toolbar>
 * <body row>
 *   <LeftSidebar>
 *   <canvas column>
 *     <CanvasArea>          ← infinite canvas (flex-1)
 *     <ArtboardsPanel>      ← page navigation strip (fixed 116px)
 *     <VideoTimeline>       ← collapsible NLE timeline (220px, hidden by default)
 *   <RightSidebar>
 *
 * The VideoTimeline is shown/hidden via the 'editor:showTimeline' and
 * 'editor:toggleTimeline' custom events fired by the Toolbar and VideosPanel.
 *
 * useVideoRenderer() is mounted here (top of the tree) so the RAF loop
 * runs as long as the editor is mounted, independent of panel visibility.
 */
export function EditorLayout() {
  const [showTimeline, setShowTimeline] = useState(false);

  // Start the video RAF render loop for the entire editor session
  useVideoRenderer();

  const handleAddShape = useCallback(
    (type: 'rect' | 'circle' | 'line' | 'text') => {
      window.dispatchEvent(new CustomEvent('editor:addShape', { detail: { type } }));
    },
    []
  );

  const handleAddImage = useCallback((file: File) => {
    window.dispatchEvent(new CustomEvent('editor:addImage', { detail: { file } }));
  }, []);

  // Listen for timeline show/toggle events from Toolbar & VideosPanel
  useEffect(() => {
    const show = () => setShowTimeline(true);
    const toggle = () => setShowTimeline((v) => !v);
    window.addEventListener('editor:showTimeline', show);
    window.addEventListener('editor:toggleTimeline', toggle);
    return () => {
      window.removeEventListener('editor:showTimeline', show);
      window.removeEventListener('editor:toggleTimeline', toggle);
    };
  }, []);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: '#0d1117' }}
    >
      {/* ── Top toolbar ──────────────────────────────────────── */}
      <Toolbar onAddImage={handleAddImage} />

      {/* ── Body: left sidebar | canvas column | right panel ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel: icon nav + expandable content */}
        <LeftSidebar onAddShape={handleAddShape} onAddImage={handleAddImage} />

        {/* Centre column: canvas + artboard pages + optional timeline */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Canvas — grows to fill remaining space */}
          <CanvasArea />

          {/* Page navigation strip */}
          <ArtboardsPanel />

          {/* Video timeline — slides in when shown */}
          {showTimeline && (
            <VideoTimeline onClose={() => setShowTimeline(false)} />
          )}
        </div>

        {/* Right panel: Design / Layers / Inspect tabs */}
        <RightSidebar />
      </div>
    </div>
  );
}
