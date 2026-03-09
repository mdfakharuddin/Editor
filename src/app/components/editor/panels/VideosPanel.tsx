/**
 * VideosPanel — Left sidebar panel for adding and managing video clips.
 *
 * Features
 * ────────
 * • Drag-and-drop or click-to-upload video files (MP4, WebM, MOV, OGG)
 * • Shows uploaded clips with thumbnail, name, duration
 * • Click a clip to select its fabric object on canvas
 * • Delete clip button
 * • Volume / mute controls per clip
 * • "Open Timeline" shortcut button
 *
 * Rendering approach explanation (shown inline as UI documentation)
 * ─────────────────────────────────────────────────────────────────
 * Videos render via the HTML5 Video + Canvas drawImage path:
 *  1. A hidden <video> element holds the decoded frames (no DOM rendering)
 *  2. fabric.Image wraps the video element — its _render() calls drawImage()
 *  3. A requestAnimationFrame loop advances currentTime and redraws the canvas
 *
 * Alternative approaches (not used):
 *  • WebGL: GPU shader compositing — better for effects, higher complexity
 *  • WebCodecs VideoDecoder: frame-accurate export / server processing
 *  • OffscreenCanvas: useful for worker thread decoding (future upgrade)
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Film, Upload, Trash2, Volume2, VolumeX,
  Play, Pause, Loader2, AlertCircle, Info,
} from 'lucide-react';
import { useVideoStore, addVideoFile, fabricVideoMap, videoElementsMap } from '../../../store/videoStore';
import { useEditorStore } from '../../../store/editorStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const ACCEPT = 'video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.webm,.mov,.ogg';

// ─── Single clip card ─────────────────────────────────────────────────────────
function ClipCard({ clip }: { clip: ReturnType<typeof useVideoStore.getState>['clips'][0] }) {
  const { removeClip, updateClip } = useVideoStore();
  const { canvas, setSelectedObjects, selectedObjects } = useEditorStore();

  const isSelected = (selectedObjects[0] as any)?.__videoClipId === clip.id;

  const handleSelect = () => {
    const fabObj = fabricVideoMap.get(clip.id);
    if (canvas && fabObj) {
      canvas.setActiveObject(fabObj);
      canvas.requestRenderAll();
      setSelectedObjects([fabObj]);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = videoElementsMap.get(clip.id);
    if (el) el.muted = !clip.muted;
    updateClip(clip.id, { muted: !clip.muted });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    const el = videoElementsMap.get(clip.id);
    if (el) el.volume = vol;
    updateClip(clip.id, { volume: vol });
  };

  return (
    <div
      onClick={handleSelect}
      style={{
        display: 'flex',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 8,
        cursor: 'pointer',
        background: isSelected ? 'rgba(99,102,241,0.12)' : 'transparent',
        border: `1px solid ${isSelected ? 'rgba(99,102,241,0.3)' : '#21283a'}`,
        marginBottom: 6,
        transition: 'all 120ms',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: 56,
          height: 38,
          borderRadius: 5,
          overflow: 'hidden',
          flexShrink: 0,
          background: '#1e2535',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #2d3748',
        }}
      >
        {clip.thumbnail ? (
          <img
            src={clip.thumbnail}
            alt={clip.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            draggable={false}
          />
        ) : (
          <Film size={16} style={{ color: '#374151' }} />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontSize: 11, color: '#d1d5db', fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1,
            }}
            title={clip.name}
          >
            {clip.name}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); removeClip(clip.id); }}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#374151', padding: '1px 3px', borderRadius: 3, flexShrink: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#374151'; }}
            title="Remove"
          >
            <Trash2 size={10} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: '#4b5563' }}>
            {clip.width}×{clip.height} · {fmtDuration(clip.duration)}
          </span>
          <span style={{ fontSize: 9, color: '#374151' }}>
            Tr.{clip.trackIndex + 1}
          </span>
        </div>

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={toggleMute}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: clip.muted ? '#374151' : '#6b7280', padding: 0, flexShrink: 0,
            }}
            title={clip.muted ? 'Unmute' : 'Mute'}
          >
            {clip.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
          </button>
          <input
            type="range"
            min={0} max={1} step={0.01}
            value={clip.volume}
            onChange={handleVolumeChange}
            onClick={(e) => e.stopPropagation()}
            style={{ flex: 1, accentColor: '#6366f1', height: 3 }}
            title="Volume"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export function VideosPanel() {
  const { clips } = useVideoStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith('video/'));
    if (!arr.length) {
      setError('Please upload a video file (MP4, WebM, MOV).');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      for (const file of arr) {
        await addVideoFile(file);
      }
      // Open timeline when first video is added
      window.dispatchEvent(new CustomEvent('editor:showTimeline'));
    } catch (err) {
      setError('Failed to load video. Check format and try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Upload zone */}
      <div style={{ padding: 10, flexShrink: 0, borderBottom: '1px solid #21283a' }}>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          style={{
            borderRadius: 10,
            border: `1.5px dashed ${isDragOver ? 'rgba(99,102,241,0.7)' : 'rgba(99,102,241,0.3)'}`,
            background: isDragOver ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)',
            padding: '14px 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            cursor: loading ? 'wait' : 'pointer',
            transition: 'all 150ms',
          }}
        >
          {loading ? (
            <Loader2 size={22} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
          ) : (
            <Film size={22} style={{ color: '#6366f1' }} />
          )}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#818cf8', margin: 0 }}>
              {loading ? 'Processing video…' : 'Click or drag video here'}
            </p>
            <p style={{ fontSize: 10, color: '#374151', margin: '2px 0 0' }}>
              MP4 · WebM · MOV · OGG
            </p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />

        {error && (
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 8px',
              borderRadius: 6,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            <AlertCircle size={11} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#f87171' }}>{error}</span>
          </div>
        )}
      </div>

      {/* Clip list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, minHeight: 0 }}>
        {clips.length === 0 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
            <div
              style={{
                borderRadius: 8,
                background: '#1a2030',
                border: '1px solid #21283a',
                padding: 12,
              }}
            >
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <Info size={11} style={{ color: '#4b5563', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 10, color: '#4b5563', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  How video rendering works
                </span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  'Hidden <video> element decodes frames',
                  'fabric.Image wraps the video element',
                  'RAF loop drives currentTime + redraws canvas',
                  'All canvas objects composite natively',
                  'Trim & timeline via manual currentTime control',
                ].map((t) => (
                  <li key={t} style={{ fontSize: 10, color: '#374151', lineHeight: 1.5 }}>{t}</li>
                ))}
              </ul>
            </div>

            <div
              style={{
                borderRadius: 8,
                background: '#1a2030',
                border: '1px solid #21283a',
                padding: 10,
              }}
            >
              <p style={{ fontSize: 10, color: '#4b5563', margin: 0, lineHeight: 1.6 }}>
                <strong style={{ color: '#6b7280' }}>Timeline:</strong> Auto-opens on first upload.
                Use Space to play/pause, drag clip edges to trim.
              </p>
            </div>
          </div>
        )}

        {clips.map((clip) => (
          <ClipCard key={clip.id} clip={clip} />
        ))}
      </div>

      {/* Open timeline shortcut */}
      {clips.length > 0 && (
        <div style={{ padding: 10, flexShrink: 0, borderTop: '1px solid #21283a' }}>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('editor:showTimeline'))}
            style={{
              width: '100%',
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: 8,
              color: '#818cf8',
              fontSize: 11,
              cursor: 'pointer',
              padding: '6px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 120ms',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.18)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.1)'; }}
          >
            <Play size={11} />
            Open Timeline
          </button>
        </div>
      )}

      {/* CSS for spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
