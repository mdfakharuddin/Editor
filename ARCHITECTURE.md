# Design Editor System Architecture

## Executive Summary

This document outlines the architecture for a browser-based design editor similar to Canva and Figma, supporting images, text, vector shapes, and video editing capabilities.

---

## 1. Frontend Structure

### Technology Stack
- **Framework**: Next.js 14+ (App Router)
- **State Management**: Zustand + React Context
- **Canvas Library**: Fabric.js 6.x
- **UI Components**: Radix UI + Tailwind CSS
- **Type Safety**: TypeScript

### Frontend Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│  (React Components, UI, Toolbars, Panels, Modals)       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Application Layer                       │
│  (State Management, Business Logic, Commands)            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   Canvas Layer                           │
│  (Fabric.js, Rendering, Object Management)               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   Service Layer                          │
│  (API Client, Media Upload, Export Services)             │
└─────────────────────────────────────────────────────────┘
```

### Core Frontend Modules

#### 1.1 Canvas Manager
- Fabric.js instance management
- Object lifecycle (create, update, delete)
- Event handling (selection, drag, resize, rotate)
- Viewport management (zoom, pan)

#### 1.2 State Management
```typescript
// Global State Structure
{
  editor: {
    canvas: FabricCanvas | null,
    selectedObjects: string[],
    zoom: number,
    viewport: { x, y, width, height }
  },
  project: {
    id: string,
    name: string,
    dimensions: { width, height },
    pages: Page[]
  },
  layers: Layer[],
  history: {
    past: CanvasState[],
    present: CanvasState,
    future: CanvasState[]
  },
  ui: {
    activeTool: string,
    activePanel: string,
    isExporting: boolean
  }
}
```

#### 1.3 Command Pattern for Undo/Redo
```typescript
interface Command {
  execute(): void;
  undo(): void;
  redo(): void;
}

class AddObjectCommand implements Command { }
class DeleteObjectCommand implements Command { }
class ModifyObjectCommand implements Command { }
class MoveObjectCommand implements Command { }
```

---

## 2. Canvas Rendering Layer

### Fabric.js Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Canvas Container                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Fabric.js Canvas                      │  │
│  │  ┌──────────────────────────────────────────────┐ │  │
│  │  │  Layer 1: Background                         │ │  │
│  │  ├──────────────────────────────────────────────┤ │  │
│  │  │  Layer 2: Images & Shapes                    │ │  │
│  │  ├──────────────────────────────────────────────┤ │  │
│  │  │  Layer 3: Text                               │ │  │
│  │  ├──────────────────────────────────────────────┤ │  │
│  │  │  Layer 4: Video Elements                     │ │  │
│  │  ├──────────────────────────────────────────────┤ │  │
│  │  │  Layer 5: Overlays & Effects                 │ │  │
│  │  └──────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Custom Fabric.js Objects

```typescript
// Custom Video Object
class VideoObject extends fabric.Image {
  - videoElement: HTMLVideoElement
  - isPlaying: boolean
  - currentTime: number
  - duration: number
  + play(): void
  + pause(): void
  + seek(time: number): void
  + render(ctx: CanvasRenderingContext2D): void
}

// Custom Text Object with Rich Formatting
class RichTextObject extends fabric.Textbox {
  - styles: TextStyle[]
  - lineHeight: number
  - letterSpacing: number
  + applyStyle(range, style): void
  + getFormattedText(): FormattedText
}

// Custom Shape Library
class VectorShape extends fabric.Path {
  - shapeType: string
  - customProperties: Record<string, any>
}
```

### Rendering Optimization Strategies

1. **Object Pooling**: Reuse canvas objects
2. **Dirty Region Rendering**: Only re-render changed areas
3. **Layer Caching**: Cache static layers as images
4. **Viewport Culling**: Don't render off-screen objects
5. **Progressive Rendering**: Render visible objects first

---

## 3. Media Management System

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Upload                         │
│        (Direct Upload with Progress Tracking)            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   Upload Service                         │
│  - Chunked upload for large files                        │
│  - Client-side validation                                │
│  - Thumbnail generation (client-side)                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Backend Processing                      │
│  - File validation & security scanning                   │
│  - Format conversion                                     │
│  - Multiple resolution generation                        │
│  - CDN upload                                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    Storage Layer                         │
│  - Original files: S3/R2/Cloud Storage                   │
│  - Optimized versions: CDN                               │
│  - Metadata: Database                                    │
└─────────────────────────────────────────────────────────┘
```

### Media Processing Pipeline

```typescript
interface MediaAsset {
  id: string;
  type: 'image' | 'video' | 'audio';
  originalUrl: string;
  variants: {
    thumbnail: string;
    preview: string;
    optimized: string;
    original: string;
  };
  metadata: {
    width: number;
    height: number;
    duration?: number; // for video
    size: number;
    format: string;
    colorSpace?: string;
  };
  status: 'uploading' | 'processing' | 'ready' | 'error';
}
```

### Image Processing
- **Client-side**: Thumbnail generation using Canvas API
- **Server-side**: Sharp.js for optimization
- **Formats**: WebP (primary), JPEG, PNG fallbacks
- **Sizes**: Original, Large (1920px), Medium (1280px), Small (640px), Thumbnail (200px)

### Video Processing
- **Server-side**: FFmpeg for transcoding
- **Formats**: MP4 (H.264), WebM (VP9) for compatibility
- **Qualities**: 1080p, 720p, 480p
- **Additional**: Thumbnail extraction, duration analysis, codec detection

---

## 4. Template System

### Template Data Structure

```typescript
interface Template {
  id: string;
  name: string;
  category: string;
  tags: string[];
  thumbnail: string;
  dimensions: {
    width: number;
    height: number;
  };
  isPremium: boolean;
  
  // Canvas state serialization
  canvasState: {
    version: string;
    objects: SerializedObject[];
    background: string | object;
  };
  
  // Variable fields that users can customize
  customizableFields: {
    id: string;
    type: 'text' | 'image' | 'color';
    objectId: string;
    property: string;
    defaultValue: any;
  }[];
}

interface TemplateCategory {
  id: string;
  name: string;
  icon: string;
  templates: Template[];
  subcategories?: TemplateCategory[];
}
```

### Template Engine Flow

```
User Selects Template
        ↓
Load Template JSON
        ↓
Deserialize Canvas State
        ↓
Render on Fabric Canvas
        ↓
Identify Customizable Fields
        ↓
Show Customization UI
        ↓
Apply User Changes
        ↓
Save as New Project
```

### Template Storage Strategy

```typescript
// Template components (reusable)
- Text styles presets
- Color palette presets
- Layout grids
- Design elements library

// Full templates
- Serialized Fabric.js state
- Asset references (not embedded)
- Metadata and categorization
```

---

## 5. Export Pipeline

### Multi-Format Export Architecture

```
┌─────────────────────────────────────────────────────────┐
│              User Initiates Export                       │
│        (PNG / JPG / PDF / MP4 / GIF)                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Export Configuration                        │
│  - Resolution (1x, 2x, 3x)                               │
│  - Quality settings                                      │
│  - Format-specific options                               │
└─────────────────────────────────────────────────────────┘
                          ↓
         ┌────────────────┴────────────────┐
         ↓                                  ↓
┌──────────────────┐            ┌──────────────────────┐
│  Client Export   │            │   Server Export      │
│  (PNG, JPG, SVG) │            │   (MP4, PDF, GIF)    │
└──────────────────┘            └──────────────────────┘
         ↓                                  ↓
┌──────────────────┐            ┌──────────────────────┐
│ Canvas.toDataURL │            │  Background Job      │
│ Canvas.toBlob    │            │  Queue (Bull/BeeQueue)│
└──────────────────┘            └──────────────────────┘
         ↓                                  ↓
         └────────────────┬────────────────┘
                          ↓
                ┌──────────────────┐
                │  Download/Share  │
                └──────────────────┘
```

### Export Implementations

#### 5.1 Static Image Export (Client-Side)

```typescript
class ImageExporter {
  async exportPNG(canvas: fabric.Canvas, options: ExportOptions): Promise<Blob> {
    const multiplier = options.scale || 1;
    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: multiplier,
    });
    return this.dataURLToBlob(dataURL);
  }

  async exportJPEG(canvas: fabric.Canvas, options: ExportOptions): Promise<Blob> {
    const multiplier = options.scale || 1;
    const dataURL = canvas.toDataURL({
      format: 'jpeg',
      quality: options.quality || 0.9,
      multiplier: multiplier,
    });
    return this.dataURLToBlob(dataURL);
  }
}
```

#### 5.2 PDF Export (Server-Side)

```typescript
// Backend: Using PDFKit or jsPDF
class PDFExporter {
  async export(canvasData: SerializedCanvas): Promise<Buffer> {
    const doc = new PDFDocument({
      size: [canvasData.width, canvasData.height],
    });
    
    // Render each object
    for (const obj of canvasData.objects) {
      if (obj.type === 'image') {
        doc.image(obj.src, obj.left, obj.top, {
          width: obj.width,
          height: obj.height,
        });
      } else if (obj.type === 'text') {
        doc.fontSize(obj.fontSize)
           .text(obj.text, obj.left, obj.top);
      }
      // ... handle other object types
    }
    
    return doc.outputBuffer();
  }
}
```

#### 5.3 Video Export (Server-Side with FFmpeg)

```typescript
class VideoExporter {
  async export(project: Project, options: VideoExportOptions): Promise<string> {
    // 1. Generate frame sequence
    const frames = await this.generateFrames(project, options);
    
    // 2. FFmpeg processing
    const outputPath = `/tmp/output-${project.id}.mp4`;
    
    await this.executeFFmpeg([
      '-framerate', '30',
      '-i', 'frame-%04d.png',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      outputPath
    ]);
    
    // 3. Return CDN URL
    return await this.uploadToCDN(outputPath);
  }

  private async generateFrames(project: Project, options: VideoExportOptions): Promise<string[]> {
    const canvas = this.createOffscreenCanvas(project.width, project.height);
    const frames: string[] = [];
    const fps = options.fps || 30;
    const duration = project.duration || 5;
    const totalFrames = fps * duration;
    
    for (let i = 0; i < totalFrames; i++) {
      const time = i / fps;
      this.renderFrameAtTime(canvas, project, time);
      const framePath = `/tmp/frame-${String(i).padStart(4, '0')}.png`;
      await this.saveCanvasToFile(canvas, framePath);
      frames.push(framePath);
    }
    
    return frames;
  }
}
```

---

## 6. Database Structure

### Entity Relationship Diagram

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│    Users     │────────<│   Projects   │>────────│    Pages     │
└──────────────┘         └──────────────┘         └──────────────┘
                                 │                         │
                                 │                         │
                         ┌───────┴────────┐        ┌───────┴────────┐
                         ↓                ↓        ↓                ↓
                  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                  │  ProjectAssets│ │    Layers    │ │   Elements   │
                  └──────────────┘ └──────────────┘ └──────────────┘
                         ↓
                  ┌──────────────┐
                  │    Assets    │
                  └──────────────┘

┌──────────────┐         ┌──────────────┐
│  Templates   │────────<│TemplateCats  │
└──────────────┘         └──────────────┘
```

### Schema Definitions

```sql
-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Projects Table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  thumbnail_url TEXT,
  canvas_state JSONB, -- Serialized Fabric.js state
  status VARCHAR(50) DEFAULT 'draft',
  is_template BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_is_template ON projects(is_template);

-- Pages Table (for multi-page projects)
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) DEFAULT 'Page 1',
  order_index INTEGER NOT NULL,
  canvas_state JSONB NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pages_project_id ON pages(project_id);

-- Assets Table
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'image', 'video', 'audio'
  original_filename VARCHAR(255),
  file_size BIGINT,
  mime_type VARCHAR(100),
  width INTEGER,
  height INTEGER,
  duration FLOAT, -- for video/audio
  storage_path TEXT NOT NULL,
  cdn_url TEXT,
  thumbnail_url TEXT,
  metadata JSONB, -- codec, bitrate, etc.
  status VARCHAR(50) DEFAULT 'processing',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assets_user_id ON assets(user_id);
CREATE INDEX idx_assets_type ON assets(type);

-- Project Assets Junction Table
CREATE TABLE project_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  used_count INTEGER DEFAULT 1,
  UNIQUE(project_id, asset_id)
);

-- Templates Table
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES template_categories(id),
  tags TEXT[],
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  thumbnail_url TEXT,
  preview_url TEXT,
  canvas_state JSONB NOT NULL,
  customizable_fields JSONB,
  is_premium BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_templates_category ON templates(category_id);
CREATE INDEX idx_templates_tags ON templates USING GIN(tags);

-- Template Categories Table
CREATE TABLE template_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  parent_id UUID REFERENCES template_categories(id),
  icon VARCHAR(255),
  order_index INTEGER
);

-- Export Jobs Table (for async exports)
CREATE TABLE export_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  format VARCHAR(50) NOT NULL,
  options JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  result_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_export_jobs_user_id ON export_jobs(user_id);
CREATE INDEX idx_export_jobs_status ON export_jobs(status);

-- Version History (for auto-save and version control)
CREATE TABLE project_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  canvas_state JSONB NOT NULL,
  thumbnail_url TEXT,
  version_number INTEGER,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_versions_project_id ON project_versions(project_id);
```

---

## 7. Real-Time Editing Architecture

### Collaborative Editing System

```
┌──────────────────────────────────────────────────────────┐
│                   Client A                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Fabric.js Canvas                                  │  │
│  │  + Local State                                     │  │
│  └────────────────────────────────────────────────────┘  │
│                      ↕ WebSocket                         │
└──────────────────────────────────────────────────────────┘
                          ↕
┌──────────────────────────────────────────────────────────┐
│           WebSocket Server (Socket.io / ws)              │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Room Manager                                      │  │
│  │  - Presence tracking                               │  │
│  │  - Operation transformation                        │  │
│  │  - Conflict resolution                             │  │
│  └────────────────────────────────────────────────────┘  │
│                      ↕ Redis Pub/Sub                     │
└──────────────────────────────────────────────────────────┘
                          ↕
┌──────────────────────────────────────────────────────────┐
│                   Client B                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Fabric.js Canvas                                  │  │
│  │  + Remote Cursors                                  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Operational Transformation (OT) / CRDT

```typescript
// Operation Types
type Operation = 
  | { type: 'add', objectId: string, data: Object }
  | { type: 'modify', objectId: string, changes: Partial<Object> }
  | { type: 'delete', objectId: string }
  | { type: 'move', objectId: string, position: { x, y } }
  | { type: 'reorder', objectId: string, zIndex: number };

interface OperationMessage {
  id: string;
  userId: string;
  projectId: string;
  operation: Operation;
  timestamp: number;
  version: number; // for conflict resolution
}

// Conflict Resolution Strategy
class ConflictResolver {
  resolve(local: Operation, remote: Operation): Operation[] {
    // Last-write-wins for same object modifications
    // Transform operations for different objects
    // Use vector clocks for ordering
  }
}
```

### Presence & Awareness

```typescript
interface UserPresence {
  userId: string;
  userName: string;
  userColor: string;
  cursor: { x: number, y: number } | null;
  selection: string[]; // selected object IDs
  viewport: { x, y, zoom };
  isActive: boolean;
  lastSeen: number;
}

// Broadcast presence updates (throttled to 50-100ms)
websocket.emit('presence:update', {
  cursor: { x, y },
  selection: selectedObjectIds
});
```

### Auto-Save Strategy

```typescript
class AutoSaveManager {
  private saveQueue: CanvasState[] = [];
  private lastSaved: number = Date.now();
  private readonly SAVE_INTERVAL = 30000; // 30 seconds
  
  queueSave(state: CanvasState) {
    this.saveQueue.push(state);
    this.debouncedSave();
  }
  
  private debouncedSave = debounce(() => {
    const latestState = this.saveQueue[this.saveQueue.length - 1];
    this.saveToServer(latestState);
    this.saveQueue = [];
  }, 2000);
  
  async saveToServer(state: CanvasState) {
    await api.post(`/projects/${projectId}/versions`, {
      canvasState: state,
      timestamp: Date.now()
    });
  }
}
```

---

## 8. Backend API Structure

### REST API Endpoints

```typescript
// Projects
GET    /api/projects                    // List user projects
POST   /api/projects                    // Create project
GET    /api/projects/:id                // Get project details
PUT    /api/projects/:id                // Update project
DELETE /api/projects/:id                // Delete project
POST   /api/projects/:id/duplicate      // Duplicate project

// Pages
GET    /api/projects/:id/pages          // List pages
POST   /api/projects/:id/pages          // Create page
PUT    /api/pages/:id                   // Update page
DELETE /api/pages/:id                   // Delete page
POST   /api/pages/:id/reorder           // Reorder pages

// Assets
GET    /api/assets                      // List user assets
POST   /api/assets/upload               // Upload asset
GET    /api/assets/:id                  // Get asset details
DELETE /api/assets/:id                  // Delete asset

// Templates
GET    /api/templates                   // List templates (with filters)
GET    /api/templates/categories        // Get categories
GET    /api/templates/:id               // Get template details
POST   /api/templates/:id/use           // Create project from template

// Export
POST   /api/export/image                // Export PNG/JPG
POST   /api/export/pdf                  // Export PDF
POST   /api/export/video                // Export MP4 (async job)
GET    /api/export/jobs/:id             // Get export job status

// Collaboration (WebSocket)
WS     /ws/project/:id                  // Real-time collaboration
```

### Backend Folder Structure

```
backend/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── projects.routes.ts
│   │   │   ├── assets.routes.ts
│   │   │   ├── templates.routes.ts
│   │   │   └── export.routes.ts
│   │   ├── controllers/
│   │   │   ├── ProjectController.ts
│   │   │   ├── AssetController.ts
│   │   │   └── ExportController.ts
│   │   └── middlewares/
│   │       ├── auth.middleware.ts
│   │       ├── validation.middleware.ts
│   │       └── rateLimit.middleware.ts
│   │
│   ├── services/
│   │   ├── MediaProcessingService.ts
│   │   ├── ExportService.ts
│   │   ├── TemplateService.ts
│   │   └── StorageService.ts
│   │
│   ├── workers/
│   │   ├── video-export.worker.ts
│   │   ├── image-optimization.worker.ts
│   │   └── pdf-generation.worker.ts
│   │
│   ├── websocket/
│   │   ├── CollaborationServer.ts
│   │   ├── RoomManager.ts
│   │   └── OperationTransformer.ts
│   │
│   ├── database/
│   │   ├── models/
│   │   ├── migrations/
│   │   └── seeds/
│   │
│   └── utils/
│       ├── ffmpeg.util.ts
│       ├── logger.ts
│       └── errors.ts
│
├── package.json
└── tsconfig.json
```

---

## 9. Frontend Folder Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── signup/
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── projects/
│   │   │   ├── templates/
│   │   │   └── assets/
│   │   │
│   │   ├── editor/
│   │   │   └── [projectId]/
│   │   │       └── page.tsx          // Main editor page
│   │   │
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── editor/
│   │   │   ├── Canvas/
│   │   │   │   ├── FabricCanvas.tsx
│   │   │   │   ├── CanvasControls.tsx
│   │   │   │   └── ObjectHandlers.tsx
│   │   │   │
│   │   │   ├── Toolbar/
│   │   │   │   ├── MainToolbar.tsx
│   │   │   │   ├── TextTools.tsx
│   │   │   │   ├── ShapeTools.tsx
│   │   │   │   └── MediaTools.tsx
│   │   │   │
│   │   │   ├── Panels/
│   │   │   │   ├── LayersPanel.tsx
│   │   │   │   ├── PropertiesPanel.tsx
│   │   │   │   ├── AssetsPanel.tsx
│   │   │   │   └── TemplatesPanel.tsx
│   │   │   │
│   │   │   ├── VideoPlayer/
│   │   │   │   └── CanvasVideoPlayer.tsx
│   │   │   │
│   │   │   └── Export/
│   │   │       └── ExportDialog.tsx
│   │   │
│   │   ├── ui/                        // Shared UI components
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   │
│   │   └── shared/
│   │       ├── Header.tsx
│   │       └── Sidebar.tsx
│   │
│   ├── lib/
│   │   ├── canvas/
│   │   │   ├── CanvasManager.ts       // Fabric.js wrapper
│   │   │   ├── ObjectFactory.ts       // Create canvas objects
│   │   │   ├── CustomObjects/
│   │   │   │   ├── VideoObject.ts
│   │   │   │   ├── RichTextObject.ts
│   │   │   │   └── VectorShape.ts
│   │   │   └── utils/
│   │   │       ├── serialization.ts
│   │   │       └── optimization.ts
│   │   │
│   │   ├── export/
│   │   │   ├── ImageExporter.ts
│   │   │   ├── PDFExporter.ts
│   │   │   └── VideoExporter.ts
│   │   │
│   │   ├── commands/                  // Command pattern
│   │   │   ├── Command.ts
│   │   │   ├── AddObjectCommand.ts
│   │   │   ├── DeleteObjectCommand.ts
│   │   │   └── ModifyObjectCommand.ts
│   │   │
│   │   └── api/
│   │       ├── client.ts
│   │       ├── projects.api.ts
│   │       ├── assets.api.ts
│   │       └── templates.api.ts
│   │
│   ├── store/                         // Zustand stores
│   │   ├── useEditorStore.ts
│   │   ├── useProjectStore.ts
│   │   ├── useLayerStore.ts
│   │   └── useHistoryStore.ts
│   │
│   ├── hooks/
│   │   ├── useCanvas.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useAutoSave.ts
│   │   └── useCollaboration.ts
│   │
│   ├── types/
│   │   ├── canvas.types.ts
│   │   ├── project.types.ts
│   │   └── export.types.ts
│   │
│   └── styles/
│       ├── globals.css
│       └── editor.css
│
├── public/
│   ├── templates/
│   └── assets/
│
├── package.json
├── next.config.js
└── tsconfig.json
```

---

## 10. Performance Optimization Strategies

### Frontend Optimization

1. **Canvas Performance**
   - Use `requestAnimationFrame` for smooth rendering
   - Implement object pooling for frequently created/destroyed objects
   - Enable hardware acceleration with `willReadFrequently: false`
   - Use Web Workers for heavy computations (filters, effects)

2. **Memory Management**
   - Dispose Fabric.js objects properly
   - Clear video element sources when removing videos
   - Implement lazy loading for large asset libraries
   - Use virtual scrolling for layer panels

3. **Network Optimization**
   - Progressive image loading (blur-up technique)
   - Asset preloading for templates
   - CDN for static assets
   - WebP with JPEG/PNG fallbacks

### Backend Optimization

1. **Media Processing**
   - Queue-based async processing (Bull/BeeQueue)
   - Horizontal scaling of worker nodes
   - Cache processed assets (Redis)
   - Progressive upload with chunking

2. **Database**
   - Index frequently queried fields
   - Use connection pooling
   - Implement caching layer (Redis)
   - Archive old projects to cold storage

3. **Real-time Performance**
   - Redis Pub/Sub for scaling WebSocket
   - Operation batching (100ms intervals)
   - Presence throttling
   - Graceful degradation for slow connections

---

## 11. Security Considerations

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Project-level permissions (owner, editor, viewer)

### File Upload Security
- File type validation (MIME type + magic bytes)
- File size limits (configurable per tier)
- Malware scanning (ClamAV)
- Sandboxed processing environment

### API Security
- Rate limiting (per user, per IP)
- CORS configuration
- Input validation and sanitization
- SQL injection prevention (parameterized queries)

### Data Privacy
- Encrypt sensitive data at rest
- HTTPS for all connections
- WSS for WebSocket
- GDPR compliance (data export, deletion)

---

## 12. Scalability Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Load Balancer (Nginx)                  │
└──────────────────────────────────────────────────────────┘
                          ↓
         ┌────────────────┴────────────────┐
         ↓                                  ↓
┌──────────────────┐            ┌──────────────────────┐
│  Web Servers     │            │  WebSocket Servers   │
│  (Next.js API)   │            │  (Socket.io)         │
│  (Auto-scaling)  │            │  (Sticky sessions)   │
└──────────────────┘            └──────────────────────┘
         ↓                                  ↓
         └────────────────┬────────────────┘
                          ↓
         ┌────────────────┴────────────────┐
         ↓                ↓                 ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │  │    Redis     │  │   Message    │
│  (Primary +  │  │  (Cache +    │  │   Queue      │
│   Replicas)  │  │   Pub/Sub)   │  │  (RabbitMQ)  │
└──────────────┘  └──────────────┘  └──────────────┘
                                            ↓
                                    ┌──────────────┐
                                    │   Workers    │
                                    │  (FFmpeg,    │
                                    │   Sharp)     │
                                    └──────────────┘
                                            ↓
                                    ┌──────────────┐
                                    │  S3 / CDN    │
                                    └──────────────┘
```

---

## 13. Technology Stack Summary

### Frontend
- **Framework**: Next.js 14+ (React 18+)
- **Canvas**: Fabric.js 6.x
- **State**: Zustand
- **Styling**: Tailwind CSS
- **UI Library**: Radix UI
- **Real-time**: Socket.io-client
- **Type Safety**: TypeScript

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js / Fastify
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Queue**: BullMQ / RabbitMQ
- **WebSocket**: Socket.io
- **ORM**: Prisma / Drizzle

### Media Processing
- **Images**: Sharp.js
- **Videos**: FFmpeg (via fluent-ffmpeg)
- **PDF**: PDFKit
- **Canvas**: node-canvas (server-side)

### Infrastructure
- **Storage**: AWS S3 / Cloudflare R2
- **CDN**: CloudFront / Cloudflare CDN
- **Hosting**: Vercel (frontend) / AWS ECS (backend)
- **Monitoring**: Sentry, DataDog

---

## 14. Development Phases

### Phase 1: MVP (8-10 weeks)
- ✅ Basic canvas editor with Fabric.js
- ✅ Image and text support
- ✅ Basic shapes (rectangle, circle, line)
- ✅ Layers panel
- ✅ Drag & drop, resize, rotate
- ✅ Export to PNG/JPG
- ✅ User authentication
- ✅ Project CRUD operations

### Phase 2: Advanced Features (6-8 weeks)
- ✅ Video support in canvas
- ✅ Rich text editing
- ✅ Template system
- ✅ Asset library
- ✅ Export to PDF
- ✅ Undo/redo system
- ✅ Auto-save

### Phase 3: Collaboration (6-8 weeks)
- ✅ Real-time collaborative editing
- ✅ Presence awareness
- ✅ Comments system
- ✅ Version history
- ✅ Share & permissions

### Phase 4: Video & Advanced Export (8-10 weeks)
- ✅ Video timeline editing
- ✅ Animation support
- ✅ Video export (MP4)
- ✅ Batch export
- ✅ Advanced effects & filters

### Phase 5: Polish & Scale (Ongoing)
- ✅ Performance optimization
- ✅ Mobile responsive design
- ✅ Offline support (PWA)
- ✅ AI features (background removal, auto-resize)
- ✅ Plugin system

---

## 15. Key Technical Challenges & Solutions

### Challenge 1: Video Performance in Canvas
**Problem**: Video rendering in canvas is CPU-intensive
**Solution**:
- Use WebGL-accelerated rendering with OffscreenCanvas
- Implement frame caching for timeline scrubbing
- Use WebCodecs API for efficient decoding
- Limit video resolution during editing (preview mode)

### Challenge 2: Real-time Collaboration Conflicts
**Problem**: Simultaneous edits cause conflicts
**Solution**:
- Implement Operational Transformation (OT)
- Object-level locking for active selections
- Last-write-wins for property conflicts
- Visual indicators for other users' selections

### Challenge 3: Large File Exports
**Problem**: High-res exports crash browser
**Solution**:
- Server-side rendering for large exports
- Tiled rendering for very large canvases
- Background job queue with progress tracking
- Progressive download (stream to client)

### Challenge 4: State Synchronization
**Problem**: Keeping Fabric.js and React state in sync
**Solution**:
- Single source of truth (Fabric.js canvas)
- React as view layer only
- Event-driven updates from canvas to UI
- Minimal state serialization

---

## Conclusion

This architecture provides a solid foundation for a production-ready design editor. The system is designed to be:

- **Scalable**: Horizontal scaling for web servers, workers, and database
- **Performant**: Optimized rendering, caching, and async processing
- **Maintainable**: Clear separation of concerns, modular architecture
- **Extensible**: Plugin system, template marketplace potential
- **Collaborative**: Real-time editing with conflict resolution
- **Reliable**: Auto-save, version history, error handling

The modular design allows for incremental development and deployment, starting with core features and gradually adding advanced capabilities.
