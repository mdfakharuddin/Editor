
# Editor

A browser-based design editor supporting vector shapes, rich text, images, multi-page artboards, video clips with an NLE-style timeline, keyframe animation, and multi-format export (PNG, JPG, PDF).

The original Figma project is available at <https://www.figma.com/design/QEfr9zUI2kOo2MmzcXPjI4/Editor>.

## Quick Start

```bash
npm install        # install dependencies
npm run dev        # start development server (http://localhost:5173)
npm run build      # create production bundle in dist/
```

## Tech Stack

| Concern | Library |
|---|---|
| UI Framework | React 18 + Vite 6 |
| Canvas | Fabric.js 5 |
| State | Zustand 5 |
| Styling | Tailwind CSS 4 + Radix UI |
| Export | jsPDF |

## Features

- **Drawing tools** — Rectangle, Ellipse, Line, Text, Image, Hand/Pan
- **Object editing** — Move, resize, rotate, fill, stroke, opacity, corner radius
- **Text styles** — Saved presets (heading, body, caption, custom)
- **Layers panel** — Drag-to-reorder, visibility toggle, lock, rename
- **Multi-page** — Unlimited artboard pages with thumbnails and drag-to-reorder
- **Undo / Redo** — 50-step linear history
- **Video timeline** — NLE-style clips, trim handles, transitions, playhead scrubbing
- **Keyframe animation** — Per-property keyframes with easing (linear, ease-in, ease-out, ease-in-out)
- **Export** — PNG, JPG (1×/2×/4×), PDF, MP4 (UI only — server pipeline required)

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `V` | Select tool |
| `H` | Hand / Pan |
| `R` | Rectangle |
| `C` | Circle |
| `L` | Line |
| `T` | Text |
| `Delete` | Delete selected |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo |
| `Ctrl+D` | Duplicate |
| `Ctrl+A` | Select all |
| `F` | Fit to screen |
| `1` | Reset zoom |

## Documentation

- **[DOCUMENTATION.md](./DOCUMENTATION.md)** — Full code reference: every component, store, hook, type, event, and integration detail.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — High-level system design notes.
- **[ATTRIBUTIONS.md](./ATTRIBUTIONS.md)** — Third-party library credits.
  