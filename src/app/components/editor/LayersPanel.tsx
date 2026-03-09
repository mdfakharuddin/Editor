import { useState, useRef } from 'react';
import { useEditorStore, syncLayersFromCanvas } from '../../store/editorStore';
import type { LayerItem } from '../../types/editor';
import {
  Eye, EyeOff, Lock, Unlock, Trash2, ChevronUp, ChevronDown,
  Square, Circle, Minus, Type, Image as ImageIcon, Box,
  Layers, GripVertical,
} from 'lucide-react';

export function LayersPanel() {
  const {
    layers, selectedObjects, canvas,
    toggleVisibility, toggleLock, deleteLayer, renameLayer,
    bringForward, sendBackward,
    setSelectedObjects, setLayers,
  } = useEditorStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItem = useRef<string | null>(null);

  const startRename = (layer: LayerItem) => {
    setEditingId(layer.id);
    setEditName(layer.name);
  };
  const commitRename = (id: string) => {
    if (editName.trim()) renameLayer(id, editName.trim());
    setEditingId(null);
  };

  const selectLayer = (layer: LayerItem) => {
    if (!canvas || layer.locked) return;
    canvas.setActiveObject(layer.fabricObject);
    canvas.requestRenderAll();
    setSelectedObjects([layer.fabricObject]);
  };

  const selectedIds = new Set(selectedObjects.map((o: any) => o.__id));

  // ── Drag-to-reorder ─────────────────────────────────────────────────────
  const handleDragStart = (id: string) => { dragItem.current = id; };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDrop = (targetId: string) => {
    if (!canvas || !dragItem.current || dragItem.current === targetId) {
      setDragOverId(null);
      dragItem.current = null;
      return;
    }

    const srcLayer = layers.find((l) => l.id === dragItem.current);
    const dstLayer = layers.find((l) => l.id === targetId);
    if (!srcLayer || !dstLayer) { setDragOverId(null); return; }

    const dstIndex = canvas.getObjects().indexOf(dstLayer.fabricObject);

    canvas.moveTo(srcLayer.fabricObject, dstIndex);
    canvas.renderAll();

    setLayers(syncLayersFromCanvas(canvas));

    setDragOverId(null);
    dragItem.current = null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid #21283a' }}
      >
        <div className="flex items-center gap-1.5">
          <Layers size={13} style={{ color: '#6366f1' }} />
          <span
            className="text-xs"
            style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}
          >
            Layers
          </span>
        </div>
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ color: '#6366f1', background: 'rgba(99,102,241,0.12)' }}
        >
          {layers.length}
        </span>
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {layers.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 gap-2 px-4 text-center">
            <Box size={20} style={{ color: '#2d3748' }} />
            <span className="text-xs" style={{ color: '#374151' }}>
              Add shapes, text or images to get started
            </span>
          </div>
        )}

        {layers.map((layer) => {
          const isSelected = selectedIds.has(layer.id);
          const isDragTarget = dragOverId === layer.id;
          return (
            <LayerRow
              key={layer.id}
              layer={layer}
              isSelected={isSelected}
              isDragTarget={isDragTarget}
              isEditing={editingId === layer.id}
              editName={editName}
              onSelect={() => selectLayer(layer)}
              onStartRename={() => startRename(layer)}
              onEditNameChange={setEditName}
              onCommitRename={() => commitRename(layer.id)}
              onToggleVisibility={() => toggleVisibility(layer.id)}
              onToggleLock={() => toggleLock(layer.id)}
              onDelete={() => deleteLayer(layer.id)}
              onBringForward={() => bringForward(layer.fabricObject)}
              onSendBackward={() => sendBackward(layer.fabricObject)}
              onDragStart={() => handleDragStart(layer.id)}
              onDragOver={(e) => handleDragOver(e, layer.id)}
              onDrop={() => handleDrop(layer.id)}
            />
          );
        })}
      </div>

      {/* Footer hint */}
      {layers.length > 0 && (
        <div
          className="px-3 py-1.5 shrink-0 text-xs"
          style={{ color: '#2d3748', borderTop: '1px solid #21283a' }}
        >
          Double-click name to rename
        </div>
      )}
    </div>
  );
}

interface LayerRowProps {
  layer: LayerItem;
  isSelected: boolean;
  isDragTarget: boolean;
  isEditing: boolean;
  editName: string;
  onSelect: () => void;
  onStartRename: () => void;
  onEditNameChange: (v: string) => void;
  onCommitRename: () => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

function LayerRow({
  layer, isSelected, isDragTarget, isEditing, editName,
  onSelect, onStartRename, onEditNameChange, onCommitRename,
  onToggleVisibility, onToggleLock, onDelete,
  onBringForward, onSendBackward,
  onDragStart, onDragOver, onDrop,
}: LayerRowProps) {
  return (
    <div
      className="group flex items-center px-1 py-1 cursor-pointer transition-colors"
      style={{
        background: isDragTarget
          ? 'rgba(99,102,241,0.2)'
          : isSelected
            ? 'rgba(99,102,241,0.12)'
            : 'transparent',
        borderLeft: isSelected ? '2px solid #6366f1' : '2px solid transparent',
        borderBottom: isDragTarget ? '1px solid #6366f1' : '1px solid transparent',
        opacity: layer.visible ? 1 : 0.45,
      }}
      onClick={onSelect}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragOver={onDragOver}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onDragEnd={() => {}}
      onMouseEnter={(e) => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !isDragTarget) (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {/* Drag handle */}
      <span
        className="opacity-0 group-hover:opacity-100 mr-0.5 cursor-grab shrink-0"
        style={{ color: '#374151' }}
      >
        <GripVertical size={10} />
      </span>

      {/* Type icon */}
      <span className="mr-1.5 shrink-0" style={{ color: isSelected ? '#818cf8' : '#4b5563' }}>
        {getLayerIcon(layer.type)}
      </span>

      {/* Name */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename();
              if (e.key === 'Escape') onCommitRename();
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-xs rounded px-1 outline-none"
            style={{ background: '#2d3748', color: '#e2e8f0', border: '1px solid #6366f1' }}
          />
        ) : (
          <span
            className="block text-xs truncate"
            style={{
              color: isSelected ? '#e2e8f0' : '#9ca3af',
              textDecoration: layer.locked ? 'none' : undefined,
            }}
            onDoubleClick={(e) => { e.stopPropagation(); onStartRename(); }}
            title={layer.name}
          >
            {layer.name}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div
        className="flex items-center gap-0.5 shrink-0 ml-0.5"
        style={{ opacity: isSelected ? 1 : 0 }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = '1';
        }}
      >
        {/* Order */}
        <IconBtn onClick={(e) => { e.stopPropagation(); onBringForward(); }} title="Bring Forward">
          <ChevronUp size={10} />
        </IconBtn>
        <IconBtn onClick={(e) => { e.stopPropagation(); onSendBackward(); }} title="Send Backward">
          <ChevronDown size={10} />
        </IconBtn>

        {/* Visibility */}
        <IconBtn
          onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
          title={layer.visible ? 'Hide' : 'Show'}
        >
          {layer.visible ? <Eye size={10} /> : <EyeOff size={10} />}
        </IconBtn>

        {/* Lock */}
        <IconBtn
          onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
          title={layer.locked ? 'Unlock' : 'Lock'}
        >
          {layer.locked
            ? <Lock size={10} style={{ color: '#f59e0b' }} />
            : <Unlock size={10} />}
        </IconBtn>

        {/* Delete */}
        <IconBtn
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete"
          danger
        >
          <Trash2 size={10} />
        </IconBtn>
      </div>
    </div>
  );
}

// Add a hover style trick via a wrapper
function LayerRowGroup({ children }: { children: React.ReactNode }) {
  return <div className="group">{children}</div>;
}

function IconBtn({
  onClick, title, danger, children,
}: {
  onClick: (e: React.MouseEvent) => void;
  title?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1 rounded transition-colors"
      style={{ color: '#4b5563' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.color = danger ? '#ef4444' : '#e2e8f0';
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.color = '#4b5563';
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function getLayerIcon(type: string) {
  const size = 11;
  switch (type) {
    case 'rect':    return <Square size={size} />;
    case 'ellipse': return <Circle size={size} />;
    case 'line':    return <Minus size={size} />;
    case 'i-text':
    case 'text':    return <Type size={size} />;
    case 'image':   return <ImageIcon size={size} />;
    default:        return <Box size={size} />;
  }
}