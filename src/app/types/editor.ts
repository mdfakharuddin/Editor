export type ToolType =
  | 'select'
  | 'rect'
  | 'circle'
  | 'line'
  | 'text'
  | 'image'
  | 'hand';

export interface LayerItem {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fabricObject: any; // fabric.Object reference
}

export interface CanvasPreset {
  label: string;
  width: number;
  height: number;
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { label: 'Presentation (1920×1080)', width: 1920, height: 1080 },
  { label: 'Instagram Post (1080×1080)', width: 1080, height: 1080 },
  { label: 'A4 Document (794×1123)', width: 794, height: 1123 },
  { label: 'Twitter Banner (1500×500)', width: 1500, height: 500 },
  { label: 'Custom (1200×800)', width: 1200, height: 800 },
];

// ─── Artboard / Multi-page ────────────────────────────────────────────────────
export interface ArtboardPage {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  fabricJSON: string | null;
  thumbnail: string | null;
}

// ─── Text Styles ──────────────────────────────────────────────────────────────

/** Character-level typographic properties mapped to Fabric.js IText */
export interface CharacterStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;          // 'normal' | 'bold' | '100'..'900'
  fontStyle?: 'normal' | 'italic';
  color?: string;               // maps to fabric `fill`
  letterSpacing?: number;       // maps to charSpacing * 100 in fabric
  lineHeight?: number;
  underline?: boolean;
}

/** Paragraph-level typographic properties */
export interface ParagraphStyle {
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  indentation?: number;         // left padding offset (px)
  bulletList?: boolean;
  bulletStyle?: 'disc' | 'decimal' | 'none';
  paragraphSpacingBefore?: number;
  paragraphSpacingAfter?: number;
}

/**
 * A reusable text style preset (like InDesign paragraph/character styles).
 * Built-in presets ship with the editor; user presets are persisted in localStorage.
 */
export interface TextStylePreset {
  id: string;
  name: string;
  category: 'heading' | 'subheading' | 'body' | 'caption' | 'custom';
  character: CharacterStyle;
  paragraph: ParagraphStyle;
  isBuiltIn: boolean;
  createdAt: number;
}

export interface ObjectProperties {
  left: number;
  top: number;
  width: number;
  height: number;
  angle: number;
  opacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  rx?: number;
  ry?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  scaleX?: number;
  scaleY?: number;
}