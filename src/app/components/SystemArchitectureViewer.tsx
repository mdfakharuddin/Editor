import { useState } from 'react';
import { 
  Server, Database, Layers, Cloud, Code, 
  FileVideo, FileImage, Download, Users, 
  Zap, Lock, Workflow, Boxes, ChevronDown, ChevronRight 
} from 'lucide-react';

interface DiagramSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  details: string[];
}

const sections: DiagramSection[] = [
  {
    id: 'frontend',
    title: '1. Frontend Structure',
    icon: <Code className="w-6 h-6" />,
    description: 'Next.js 14+ with React, Zustand for state management, and Tailwind CSS',
    details: [
      'Presentation Layer: React components, UI, toolbars, panels',
      'Application Layer: State management, business logic, command pattern',
      'Canvas Layer: Fabric.js integration, object management',
      'Service Layer: API client, media upload, export services'
    ]
  },
  {
    id: 'canvas',
    title: '2. Canvas Rendering Layer',
    icon: <Layers className="w-6 h-6" />,
    description: 'Fabric.js for canvas rendering with custom objects for video, text, and shapes',
    details: [
      'Custom VideoObject: Extends fabric.Image with playback controls',
      'RichTextObject: Advanced text formatting and styling',
      'VectorShape: Custom shape library with properties',
      'Optimization: Object pooling, layer caching, viewport culling',
      'Performance: Dirty region rendering, progressive rendering'
    ]
  },
  {
    id: 'media',
    title: '3. Media Management',
    icon: <FileImage className="w-6 h-6" />,
    description: 'Handles image and video uploads, processing, and CDN distribution',
    details: [
      'Client Upload: Chunked upload with progress tracking',
      'Server Processing: Format conversion, thumbnail generation',
      'Image Processing: Sharp.js (WebP, JPEG, PNG) at multiple resolutions',
      'Video Processing: FFmpeg transcoding (MP4, WebM) at 1080p/720p/480p',
      'Storage: S3/R2 for originals, CDN for optimized versions'
    ]
  },
  {
    id: 'templates',
    title: '4. Template System',
    icon: <Boxes className="w-6 h-6" />,
    description: 'Pre-designed templates with customizable fields',
    details: [
      'Template Structure: Serialized canvas state with metadata',
      'Customizable Fields: Text, images, colors that users can modify',
      'Categories: Organized by use case (social media, presentations, etc.)',
      'Template Engine: Deserialize → Render → Customize → Save as project',
      'Reusable Components: Text styles, color palettes, layout grids'
    ]
  },
  {
    id: 'export',
    title: '5. Export Pipeline',
    icon: <Download className="w-6 h-6" />,
    description: 'Multi-format export supporting PNG, JPG, PDF, MP4, and GIF',
    details: [
      'Client-side: PNG/JPG via canvas.toDataURL() and canvas.toBlob()',
      'Server-side PDF: PDFKit for vector-based exports',
      'Video Export: FFmpeg frame sequence generation at 30fps',
      'Quality Options: Multiple resolutions (1x, 2x, 3x scaling)',
      'Async Jobs: Background queue for large exports with progress tracking'
    ]
  },
  {
    id: 'database',
    title: '6. Database Structure',
    icon: <Database className="w-6 h-6" />,
    description: 'PostgreSQL schema for projects, assets, templates, and collaboration',
    details: [
      'Users: Authentication, subscription tier, profile',
      'Projects: Canvas state (JSONB), dimensions, multi-page support',
      'Assets: Media files with metadata, CDN URLs, processing status',
      'Templates: Categories, tags, customizable fields',
      'Version History: Auto-save snapshots with timestamps',
      'Export Jobs: Async job tracking with status and progress'
    ]
  },
  {
    id: 'realtime',
    title: '7. Real-time Collaboration',
    icon: <Users className="w-6 h-6" />,
    description: 'WebSocket-based collaborative editing with operational transformation',
    details: [
      'WebSocket Server: Socket.io with Redis Pub/Sub for scaling',
      'Operational Transformation: Conflict resolution for simultaneous edits',
      'Presence System: Real-time cursors, selections, and viewport tracking',
      'Auto-Save: Debounced saves every 30 seconds with queue management',
      'User Awareness: Active users, last seen, color-coded cursors',
      'Performance: Operation batching (100ms), presence throttling (50ms)'
    ]
  }
];

const techStack = {
  frontend: [
    { name: 'Next.js 14+', desc: 'React framework with App Router' },
    { name: 'Fabric.js 6.x', desc: 'Canvas manipulation library' },
    { name: 'Zustand', desc: 'State management' },
    { name: 'Tailwind CSS', desc: 'Utility-first styling' },
    { name: 'TypeScript', desc: 'Type safety' }
  ],
  backend: [
    { name: 'Node.js 20+', desc: 'Server runtime' },
    { name: 'Express/Fastify', desc: 'HTTP server' },
    { name: 'Socket.io', desc: 'WebSocket server' },
    { name: 'PostgreSQL', desc: 'Primary database' },
    { name: 'Redis', desc: 'Cache & Pub/Sub' }
  ],
  processing: [
    { name: 'FFmpeg', desc: 'Video processing' },
    { name: 'Sharp.js', desc: 'Image optimization' },
    { name: 'PDFKit', desc: 'PDF generation' },
    { name: 'BullMQ', desc: 'Job queue' }
  ]
};

const systemFlow = [
  { step: '1', title: 'User Authentication', desc: 'JWT-based auth, role-based access control' },
  { step: '2', title: 'Project Creation', desc: 'Choose template or blank canvas with dimensions' },
  { step: '3', title: 'Canvas Editing', desc: 'Drag, resize, rotate objects with Fabric.js' },
  { step: '4', title: 'Media Upload', desc: 'Chunked upload → Processing → CDN distribution' },
  { step: '5', title: 'Real-time Sync', desc: 'WebSocket broadcasts operations to collaborators' },
  { step: '6', title: 'Auto-save', desc: 'Debounced saves to database (30s interval)' },
  { step: '7', title: 'Export', desc: 'Client or server-side rendering based on format' }
];

export function SystemArchitectureViewer() {
  const [expandedSection, setExpandedSection] = useState<string | null>('frontend');
  const [activeTab, setActiveTab] = useState<'diagram' | 'stack' | 'flow'>('diagram');

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Server className="w-12 h-12 text-blue-400" />
            <h1 className="text-5xl font-bold text-white">Design Editor Architecture</h1>
          </div>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            A comprehensive system architecture for a browser-based design editor similar to Canva and Figma,
            supporting images, text, vector shapes, and video with real-time collaboration.
          </p>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('diagram')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'diagram'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            System Diagram
          </button>
          <button
            onClick={() => setActiveTab('stack')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'stack'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tech Stack
          </button>
          <button
            onClick={() => setActiveTab('flow')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'flow'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            System Flow
          </button>
        </div>

        {/* Content */}
        {activeTab === 'diagram' && (
          <div className="space-y-4">
            {sections.map((section) => (
              <div
                key={section.id}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden hover:border-slate-600 transition-all"
              >
                <button
                  onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                  className="w-full px-6 py-4 flex items-center gap-4 text-left hover:bg-slate-700/30 transition-colors"
                >
                  <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
                    {section.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-1">{section.title}</h3>
                    <p className="text-slate-400 text-sm">{section.description}</p>
                  </div>
                  {expandedSection === section.id ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                {expandedSection === section.id && (
                  <div className="px-6 pb-6 pt-2">
                    <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                      {section.details.map((detail, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                          <p className="text-slate-300 text-sm leading-relaxed">{detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'stack' && (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Code className="w-8 h-8 text-green-400" />
                <h3 className="text-2xl font-bold text-white">Frontend</h3>
              </div>
              <div className="space-y-4">
                {techStack.frontend.map((tech, idx) => (
                  <div key={idx} className="border-l-2 border-green-400/30 pl-4">
                    <h4 className="font-semibold text-white mb-1">{tech.name}</h4>
                    <p className="text-sm text-slate-400">{tech.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Server className="w-8 h-8 text-blue-400" />
                <h3 className="text-2xl font-bold text-white">Backend</h3>
              </div>
              <div className="space-y-4">
                {techStack.backend.map((tech, idx) => (
                  <div key={idx} className="border-l-2 border-blue-400/30 pl-4">
                    <h4 className="font-semibold text-white mb-1">{tech.name}</h4>
                    <p className="text-sm text-slate-400">{tech.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
              <div className="flex items-center gap-3 mb-6">
                <FileVideo className="w-8 h-8 text-purple-400" />
                <h3 className="text-2xl font-bold text-white">Processing</h3>
              </div>
              <div className="space-y-4">
                {techStack.processing.map((tech, idx) => (
                  <div key={idx} className="border-l-2 border-purple-400/30 pl-4">
                    <h4 className="font-semibold text-white mb-1">{tech.name}</h4>
                    <p className="text-sm text-slate-400">{tech.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'flow' && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-8">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-2xl font-bold text-white mb-8 text-center">System Workflow</h3>
              <div className="space-y-6">
                {systemFlow.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {item.step}
                    </div>
                    <div className="flex-1 pt-1">
                      <h4 className="text-xl font-semibold text-white mb-2">{item.title}</h4>
                      <p className="text-slate-400">{item.desc}</p>
                    </div>
                    {idx < systemFlow.length - 1 && (
                      <div className="absolute left-[4.5rem] mt-12 w-0.5 h-6 bg-gradient-to-b from-blue-500/50 to-purple-600/50" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-xl border border-blue-500/20 p-6">
            <Zap className="w-8 h-8 text-blue-400 mb-3" />
            <h4 className="font-semibold text-white mb-2">Performance</h4>
            <p className="text-sm text-slate-300">
              Optimized rendering, layer caching, viewport culling, and progressive loading for smooth editing.
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-xl border border-purple-500/20 p-6">
            <Lock className="w-8 h-8 text-purple-400 mb-3" />
            <h4 className="font-semibold text-white mb-2">Security</h4>
            <p className="text-sm text-slate-300">
              JWT auth, file validation, malware scanning, rate limiting, and GDPR compliance built-in.
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 rounded-xl border border-green-500/20 p-6">
            <Workflow className="w-8 h-8 text-green-400 mb-3" />
            <h4 className="font-semibold text-white mb-2">Scalability</h4>
            <p className="text-sm text-slate-300">
              Horizontal scaling, load balancing, Redis Pub/Sub, message queues, and CDN distribution.
            </p>
          </div>
        </div>

        {/* Documentation Link */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700 px-6 py-3">
            <FileImage className="w-5 h-5 text-blue-400" />
            <span className="text-slate-300">
              Complete architecture documentation available in <code className="text-blue-400 font-mono">ARCHITECTURE.md</code>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
