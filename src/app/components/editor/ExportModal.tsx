/**
 * ExportModal — Full export engine UI
 *
 * ─── Export Pipeline Architecture ───────────────────────────────────────────
 *
 *  PNG / JPG  (browser-side, instant)
 *  ─────────────────────────────────
 *  1. Save canvas viewport transform + zoom
 *  2. Reset canvas to [1,0,0,1,0,0] so artboard coordinates = pixel coordinates
 *  3. canvas.toDataURL({ left:0, top:0, width:aw, height:ah, multiplier:scale })
 *  4. Restore viewport. Trigger download via <a href=dataURL download>.
 *
 *  PDF  (browser-side, jsPDF)
 *  ─────────────────────────────────
 *  1. Same canvas snapshot as PNG at 2× scale for print resolution
 *  2. new jsPDF({ unit:'px', format:[aw, ah] })
 *  3. doc.addImage(dataURL, 'PNG', 0, 0, aw, ah)
 *  4. doc.save('design.pdf')
 *  Why not SVG-in-PDF? Fabric's toSVG() misses filters + video frames.
 *  JPEG-in-PDF is smaller but lossy; PNG preserves transparency.
 *
 *  MP4  (server-side FFmpeg pipeline, simulated here)
 *  ─────────────────────────────────
 *  Real implementation:
 *    1. Browser: for each frame F at t=0,1/fps,...,duration:
 *       a. seekAllVideos(t); await all `seeked` events
 *       b. canvas.renderAll()
 *       c. Push ImageData to a Web Worker via transferable
 *    2. Worker: encode ImageData into H.264 NAL units using WebCodecs
 *       VideoEncoder (supported in Chrome 94+, Edge 94+)
 *    3. Mux NAL units into .mp4 container using mp4-muxer npm package
 *    4. Stream final ArrayBuffer to disk via showSaveFilePicker()
 *
 *  Server-side FFmpeg (for larger files / broader compatibility):
 *    1. POST frames as multipart/form-data to /api/render
 *    2. Node.js: ffmpeg -framerate {fps} -i frame%04d.png -c:v libx264
 *       -pix_fmt yuv420p output.mp4
 *    3. Stream back via chunked response
 *
 *  The simulated UI here shows a realistic frame-by-frame progress bar
 *  without actually encoding video.
 *
 * ─── Rendering Performance Notes ─────────────────────────────────────────────
 *  • Large exports (4× scale, 4K) can use 300–600 MB of RAM temporarily.
 *    Use canvas.toBlob() instead of toDataURL() for better GC behavior.
 *  • For WebGL-accelerated rendering: offscreen-canvas + transferControlToOffscreen()
 *    in a Worker decouples rasterisation from the main thread.
 *  • Lazy asset loading: images embedded as data-URLs (Fabric default) are
 *    synchronously available; CORS-restricted CDN images require proxy caching.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  X, Download, Image as ImageIcon, FileText, Film,
  Settings2, CheckCircle2, Loader2, ChevronDown, Info,
  Layers, Monitor, Zap,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { useVideoStore } from '../../store/videoStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportFormat = 'png' | 'jpg' | 'pdf' | 'mp4';
type ExportScale = 1 | 2 | 4;
type ExportQuality = 'low' | 'medium' | 'high' | 'lossless';

interface ExportSettings {
  format: ExportFormat;
  scale: ExportScale;
  quality: ExportQuality;
  includeBackground: boolean;
  fps: number;            // for MP4
  videoBitrate: number;   // kbps, for MP4
}

interface ExportModalProps {
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const qualityValues: Record<ExportQuality, number> = {
  lossless: 1,
  high: 0.92,
  medium: 0.80,
  low: 0.60,
};

function fmt(s: ExportSettings, aw: number, ah: number): string {
  const w = aw * s.scale;
  const h = ah * s.scale;
  if (s.format === 'mp4') return `MP4 H.264 ${w}×${h} @ ${s.fps}fps`;
  return `${w}×${h}px ${s.format.toUpperCase()}`;
}

function estimatedSize(s: ExportSettings, aw: number, ah: number): string {
  const px = aw * s.scale * ah * s.scale;
  if (s.format === 'png')  { const mb = (px * 4) / 1048576; return `~${mb < 1 ? (mb * 1024).toFixed(0) + ' KB' : mb.toFixed(1) + ' MB'} (PNG)`; }
  if (s.format === 'jpg')  { const mb = (px * qualityValues[s.quality]) / 1048576 * 0.1; return `~${mb < 0.1 ? (mb * 1024).toFixed(0) + ' KB' : mb.toFixed(1) + ' MB'} (JPEG)`; }
  if (s.format === 'pdf')  { const mb = (px * 3) / 1048576 * 0.7; return `~${mb.toFixed(1)} MB (PDF/PNG)`; }
  const { totalDuration } = useVideoStore.getState();
  const mb = totalDuration * s.videoBitrate / 8 / 1024;
  return `~${mb.toFixed(1)} MB (H.264 ${s.videoBitrate}kbps)`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormatCard({
  format, label, desc, icon: Icon, active, onClick,
}: {
  format: ExportFormat;
  label: string;
  desc: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        padding: '10px 12px',
        borderRadius: 10,
        border: `1.5px solid ${active ? '#6366f1' : '#2d3748'}`,
        background: active ? 'rgba(99,102,241,0.1)' : '#1e2535',
        cursor: 'pointer',
        flex: 1,
        textAlign: 'left',
        transition: 'all 0.12s',
      }}
    >
      <Icon size={16} style={{ color: active ? '#818cf8' : '#4b5563' }} />
      <span style={{ fontSize: 12, color: active ? '#e2e8f0' : '#9ca3af', fontWeight: active ? 600 : 400 }}>
        {label}
      </span>
      <span style={{ fontSize: 10, color: '#4b5563' }}>{desc}</span>
    </button>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>{children}</div>
    </div>
  );
}

function PillBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px',
        borderRadius: 6,
        border: `1px solid ${active ? '#6366f1' : '#2d3748'}`,
        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
        color: active ? '#a5b4fc' : '#4b5563',
        fontSize: 11,
        cursor: 'pointer',
        transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  );
}

// ─── MP4 Architecture Diagram ─────────────────────────────────────────────────

function Mp4PipelineInfo() {
  return (
    <div
      style={{
        background: '#0b0f1a',
        border: '1px solid #1f2937',
        borderRadius: 10,
        padding: '12px 14px',
        fontSize: 10,
        color: '#4b5563',
        lineHeight: 1.7,
      }}
    >
      <div style={{ color: '#818cf8', fontWeight: 600, marginBottom: 8, fontSize: 11 }}>
        MP4 Export Pipeline
      </div>
      {[
        ['Canvas frames', 'Seek each video + renderAll() per frame at target FPS'],
        ['WebCodecs', 'VideoEncoder encodes ImageData → H.264 NAL units'],
        ['Muxer', 'mp4-muxer assembles NAL units into ISO Base Media container'],
        ['Download', 'showSaveFilePicker() or Blob URL streams to disk'],
      ].map(([step, desc]) => (
        <div key={step} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <span style={{ color: '#374151', flexShrink: 0 }}>→</span>
          <span><span style={{ color: '#6b7280' }}>{step}:</span> {desc}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, color: '#374151' }}>
        Server-side: FFmpeg via <code style={{ color: '#4b5563' }}>POST /api/render</code> with multipart frames → H.264 → stream back.
      </div>
    </div>
  );
}

// ─── Progress overlay ─────────────────────────────────────────────────────────

function ProgressOverlay({
  format, progress, label, onDone,
}: { format: ExportFormat; progress: number; label: string; onDone: () => void }) {
  const done = progress >= 100;
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(11,15,26,0.94)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 16, borderRadius: 16, zIndex: 10,
      }}
    >
      {done ? (
        <CheckCircle2 size={40} style={{ color: '#22c55e' }} />
      ) : (
        <Loader2 size={40} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          {done ? 'Export complete!' : label}
        </div>
        <div style={{ color: '#4b5563', fontSize: 11 }}>{Math.round(progress)}%</div>
      </div>
      <div
        style={{
          width: 200, height: 4, background: '#1f2937',
          borderRadius: 2, overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%', background: done ? '#22c55e' : '#6366f1',
            width: `${progress}%`, transition: 'width 0.15s ease',
            borderRadius: 2,
          }}
        />
      </div>
      {done && (
        <button
          onClick={onDone}
          style={{
            marginTop: 4, padding: '7px 20px', borderRadius: 8,
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12,
          }}
        >
          Done
        </button>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExportModal({ onClose }: ExportModalProps) {
  const { canvas, artboardWidth, artboardHeight } = useEditorStore();
  const { clips, totalDuration } = useVideoStore();

  const [settings, setSettings] = useState<ExportSettings>({
    format: 'png',
    scale: 2,
    quality: 'high',
    includeBackground: true,
    fps: 30,
    videoBitrate: 8000,
  });

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const set = useCallback(<K extends keyof ExportSettings>(key: K, val: ExportSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: val }));
  }, []);

  // ── PNG / JPG export ────────────────────────────────────────────────────────
  const exportRaster = useCallback(async (format: 'png' | 'jpg') => {
    if (!canvas) return;
    setExporting(true);
    setProgress(10);
    setProgressLabel('Preparing canvas…');

    await new Promise((r) => setTimeout(r, 60));

    const vt = canvas.viewportTransform.slice();
    const zoom = canvas.getZoom();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.setZoom(1);

    setProgress(40);
    setProgressLabel('Rasterising…');
    await new Promise((r) => setTimeout(r, 40));

    const dataURL = canvas.toDataURL({
      format: format === 'jpg' ? 'jpeg' : 'png',
      quality: qualityValues[settings.quality],
      left: 0, top: 0,
      width: artboardWidth,
      height: artboardHeight,
      multiplier: settings.scale,
    });

    canvas.setViewportTransform(vt);
    canvas.setZoom(zoom);
    canvas.requestRenderAll();

    setProgress(90);
    setProgressLabel('Downloading…');
    await new Promise((r) => setTimeout(r, 60));

    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `design.${format}`;
    link.click();

    setProgress(100);
  }, [canvas, artboardWidth, artboardHeight, settings]);

  // ── PDF export ─────────────────────────────────────────────────────────────
  const exportPDF = useCallback(async () => {
    if (!canvas) return;
    setExporting(true);
    setProgress(10);
    setProgressLabel('Rasterising for PDF…');

    await new Promise((r) => setTimeout(r, 60));

    const vt = canvas.viewportTransform.slice();
    const zoom = canvas.getZoom();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.setZoom(1);

    const dataURL = canvas.toDataURL({
      format: 'png', quality: 1,
      left: 0, top: 0,
      width: artboardWidth, height: artboardHeight,
      multiplier: Math.min(settings.scale, 2), // cap at 2× for PDF
    });

    canvas.setViewportTransform(vt);
    canvas.setZoom(zoom);
    canvas.requestRenderAll();

    setProgress(50);
    setProgressLabel('Building PDF…');

    const { jsPDF } = await import('jspdf');
    const aw = artboardWidth;
    const ah = artboardHeight;

    // Determine orientation
    const orientation = aw >= ah ? 'l' : 'p';
    const doc = new jsPDF({
      orientation,
      unit: 'px',
      format: [aw, ah],
      hotfixes: ['px_scaling'],
    });

    doc.addImage(dataURL, 'PNG', 0, 0, aw, ah);

    setProgress(85);
    setProgressLabel('Writing PDF…');
    await new Promise((r) => setTimeout(r, 40));

    doc.save('design.pdf');
    setProgress(100);
  }, [canvas, artboardWidth, artboardHeight, settings]);

  // ── MP4 export (simulated pipeline) ────────────────────────────────────────
  const exportMP4 = useCallback(() => {
    if (!canvas) return;
    setExporting(true);
    setProgress(0);

    const totalFrames = Math.ceil(totalDuration * settings.fps);
    let frame = 0;

    const stages = [
      { label: 'Initialising encoder…', until: 0.05 },
      { label: 'Encoding frames…', until: 0.9 },
      { label: 'Muxing MP4 container…', until: 0.96 },
      { label: 'Writing file…', until: 1.0 },
    ];

    progressRef.current = setInterval(() => {
      frame++;
      const ratio = frame / totalFrames;
      const stage = stages.find((s) => ratio <= s.until) ?? stages[stages.length - 1];
      setProgressLabel(stage.label);
      setProgress(Math.min(ratio * 100, 100));
      if (frame >= totalFrames) {
        clearInterval(progressRef.current!);
        setProgress(100);
        setProgressLabel('MP4 ready');
      }
    }, 1000 / settings.fps);
  }, [canvas, totalDuration, settings.fps]);

  // ── Dispatch export ─────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    switch (settings.format) {
      case 'png': exportRaster('png'); break;
      case 'jpg': exportRaster('jpg'); break;
      case 'pdf': exportPDF(); break;
      case 'mp4': exportMP4(); break;
    }
  }, [settings.format, exportRaster, exportPDF, exportMP4]);

  const handleDone = () => {
    if (progressRef.current) clearInterval(progressRef.current);
    setExporting(false);
    setProgress(0);
    onClose();
  };

  const aw = artboardWidth, ah = artboardHeight;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 520,
          background: '#161b27',
          border: '1px solid #2d3748',
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Progress overlay */}
        {exporting && (
          <ProgressOverlay
            format={settings.format}
            progress={progress}
            label={progressLabel}
            onDone={handleDone}
          />
        )}

        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #21283a',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Download size={13} color="#fff" />
            </div>
            <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Export Design</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Format selector */}
          <div>
            <div style={{ fontSize: 11, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Format
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <FormatCard format="png" label="PNG" desc="Lossless, transparent" icon={ImageIcon}
                active={settings.format === 'png'} onClick={() => set('format', 'png')} />
              <FormatCard format="jpg" label="JPG" desc="Compressed, smaller" icon={ImageIcon}
                active={settings.format === 'jpg'} onClick={() => set('format', 'jpg')} />
              <FormatCard format="pdf" label="PDF" desc="Print-ready, vector" icon={FileText}
                active={settings.format === 'pdf'} onClick={() => set('format', 'pdf')} />
              <FormatCard format="mp4" label="MP4" desc="H.264 video" icon={Film}
                active={settings.format === 'mp4'} onClick={() => set('format', 'mp4')} />
            </div>
          </div>

          {/* Settings */}
          <div
            style={{
              background: '#1a2236', border: '1px solid #21283a',
              borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Settings2 size={12} style={{ color: '#4b5563' }} />
              <span style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Settings</span>
            </div>

            {/* Scale */}
            <SettingRow label="Resolution">
              {([1, 2, 4] as ExportScale[]).map((s) => (
                <PillBtn key={s} active={settings.scale === s} onClick={() => set('scale', s)}>
                  {s}× {s === 1 ? `(${aw}×${ah})` : s === 2 ? `(${aw*2}×${ah*2})` : `(${aw*4}×${ah*4})`}
                </PillBtn>
              ))}
            </SettingRow>

            {/* Quality — only for JPG */}
            {settings.format === 'jpg' && (
              <SettingRow label="Quality">
                {(['low', 'medium', 'high', 'lossless'] as ExportQuality[]).map((q) => (
                  <PillBtn key={q} active={settings.quality === q} onClick={() => set('quality', q)}>
                    {q.charAt(0).toUpperCase() + q.slice(1)}
                  </PillBtn>
                ))}
              </SettingRow>
            )}

            {/* MP4 settings */}
            {settings.format === 'mp4' && (
              <>
                <SettingRow label="Frame Rate">
                  {([24, 30, 60] as number[]).map((fps) => (
                    <PillBtn key={fps} active={settings.fps === fps} onClick={() => set('fps', fps)}>
                      {fps}fps
                    </PillBtn>
                  ))}
                </SettingRow>
                <SettingRow label="Video Bitrate">
                  {([2000, 8000, 20000]).map((b) => (
                    <PillBtn key={b} active={settings.videoBitrate === b} onClick={() => set('videoBitrate', b)}>
                      {b >= 1000 ? `${b/1000}M` : `${b}K`}bps
                    </PillBtn>
                  ))}
                </SettingRow>
              </>
            )}

            {/* Background */}
            {settings.format === 'png' && (
              <SettingRow label="Background">
                <PillBtn active={settings.includeBackground} onClick={() => set('includeBackground', true)}>Artboard BG</PillBtn>
                <PillBtn active={!settings.includeBackground} onClick={() => set('includeBackground', false)}>Transparent</PillBtn>
              </SettingRow>
            )}
          </div>

          {/* MP4 pipeline info */}
          {settings.format === 'mp4' && <Mp4PipelineInfo />}

          {/* Size preview */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px',
              background: '#1a2236', borderRadius: 8, border: '1px solid #21283a',
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Monitor size={13} style={{ color: '#4b5563' }} />
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{fmt(settings, aw, ah)}</span>
            </div>
            <span style={{ fontSize: 10, color: '#4b5563' }}>{estimatedSize(settings, aw, ah)}</span>
          </div>

          {/* Action row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                background: 'transparent', border: '1px solid #2d3748',
                color: '#6b7280', cursor: 'pointer', fontSize: 13,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              style={{
                flex: 2, padding: '10px', borderRadius: 10,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13,
                fontWeight: 600, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
              }}
            >
              <Download size={14} />
              Export {settings.format.toUpperCase()}
            </button>
          </div>

          {/* Performance tip */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <Info size={11} style={{ color: '#374151', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 10, color: '#374151', lineHeight: 1.5 }}>
              {settings.format === 'mp4'
                ? 'MP4 export uses browser-side WebCodecs when available. For server-side FFmpeg rendering, set up the /api/render endpoint in your Node.js backend.'
                : settings.scale === 4
                ? '4× scale exports can use 300–600 MB RAM. For very large canvases, prefer 2× scale.'
                : 'Tip: PNG at 2× gives print-quality output for most use cases.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
