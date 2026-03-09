import { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Film, Music, FileText, X, Check } from 'lucide-react';

interface UploadsPanelProps {
  onAddImage: (file: File) => void;
}

interface UploadedFile {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'doc';
  size: string;
  url: string;
  date: string;
}

// Mock uploaded files for demonstration
const MOCK_UPLOADS: UploadedFile[] = [
  { id: 'u1', name: 'hero-bg.png', type: 'image', size: '2.4 MB', url: '', date: 'Today' },
  { id: 'u2', name: 'logo-v2.svg', type: 'image', size: '48 KB', url: '', date: 'Today' },
  { id: 'u3', name: 'product-shot.jpg', type: 'image', size: '1.8 MB', url: '', date: 'Yesterday' },
  { id: 'u4', name: 'team-photo.jpg', type: 'image', size: '3.2 MB', url: '', date: 'Yesterday' },
  { id: 'u5', name: 'intro.mp4', type: 'video', size: '18.5 MB', url: '', date: 'Last week' },
  { id: 'u6', name: 'brand-doc.pdf', type: 'doc', size: '580 KB', url: '', date: 'Last week' },
];

function FileTypeIcon({ type }: { type: UploadedFile['type'] }) {
  const props = { size: 16 };
  if (type === 'image') return <ImageIcon {...props} style={{ color: '#818cf8' }} />;
  if (type === 'video') return <Film {...props} style={{ color: '#f97316' }} />;
  if (type === 'audio') return <Music {...props} style={{ color: '#22c55e' }} />;
  return <FileText {...props} style={{ color: '#94a3b8' }} />;
}

export function UploadsPanel({ onAddImage }: UploadsPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploads] = useState<UploadedFile[]>(MOCK_UPLOADS);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      setTimeout(() => {
        onAddImage(file);
        setUploading(false);
      }, 800);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (file) {
      setUploading(true);
      setTimeout(() => {
        onAddImage(file);
        setUploading(false);
      }, 800);
    }
  };

  // Group by date
  const grouped = uploads.reduce<Record<string, UploadedFile[]>>((acc, f) => {
    if (!acc[f.date]) acc[f.date] = [];
    acc[f.date].push(f);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Upload drop zone */}
      <div className="p-3 shrink-0">
        <button
          onClick={() => fileRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-xl transition-all"
          style={{
            background: isDragging ? 'rgba(99,102,241,0.12)' : '#1e2535',
            border: `1.5px dashed ${isDragging ? '#6366f1' : '#374151'}`,
            color: isDragging ? '#818cf8' : '#6b7280',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = '#6366f1';
            (e.currentTarget as HTMLElement).style.color = '#818cf8';
            (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.06)';
          }}
          onMouseLeave={(e) => {
            if (!isDragging) {
              (e.currentTarget as HTMLElement).style.borderColor = '#374151';
              (e.currentTarget as HTMLElement).style.color = '#6b7280';
              (e.currentTarget as HTMLElement).style.background = '#1e2535';
            }
          }}
        >
          {uploading ? (
            <>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(99,102,241,0.15)' }}
              >
                <Check size={16} style={{ color: '#818cf8' }} />
              </div>
              <span className="text-xs">Uploading…</span>
            </>
          ) : (
            <>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(99,102,241,0.1)' }}
              >
                <Upload size={18} />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs">Click to upload or drag & drop</span>
                <span style={{ fontSize: 10, color: '#4b5563' }}>PNG, JPG, SVG, MP4 up to 50MB</span>
              </div>
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Uploaded files */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(grouped).map(([date, files]) => (
          <div key={date}>
            <div className="px-3 py-2 shrink-0">
              <span className="text-xs" style={{ color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {date}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 px-3 pb-2">
              {files.filter((f) => f.type === 'image').map((file) => (
                <button
                  key={file.id}
                  className="relative rounded-lg overflow-hidden group"
                  style={{ height: 72, background: '#1e2535', border: '1.5px solid #2d3748' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#6366f1';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#2d3748';
                  }}
                >
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                    <ImageIcon size={20} style={{ color: '#374151' }} />
                    <span style={{ fontSize: 9, color: '#374151', maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </span>
                  </div>
                  <div
                    className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity"
                    style={{ background: 'rgba(99,102,241,0.2)' }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.opacity = '1'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.opacity = '0'}
                  >
                    <span className="text-xs text-white px-2 py-1 rounded" style={{ background: 'rgba(0,0,0,0.6)' }}>
                      Add
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {/* Non-image files as list items */}
            {files.filter((f) => f.type !== 'image').map((file) => (
              <button
                key={file.id}
                className="w-full flex items-center gap-3 px-3 py-2 transition-colors"
                style={{ background: 'transparent' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: '#1e2535', border: '1px solid #2d3748' }}
                >
                  <FileTypeIcon type={file.type} />
                </div>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-xs truncate" style={{ color: '#9ca3af' }}>{file.name}</span>
                  <span style={{ fontSize: 10, color: '#374151' }}>{file.size}</span>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Storage indicator */}
      <div
        className="px-3 py-3 shrink-0"
        style={{ borderTop: '1px solid #21283a' }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ fontSize: 10, color: '#6b7280' }}>Storage used</span>
          <span style={{ fontSize: 10, color: '#6366f1' }}>26.6 MB / 1 GB</span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: '#1e2535' }}>
          <div className="h-full rounded-full" style={{ width: '2.7%', background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
        </div>
      </div>
    </div>
  );
}
