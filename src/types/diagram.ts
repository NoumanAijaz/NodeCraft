import type { Node, Edge } from '@xyflow/react';

export type ShapeType = 'rectangle' | 'circle' | 'diamond' | 'sticky' | 'text' | 'cylinder' | 'image' | 'frame' | 'card' | 'drawing' | 'sticker' | 'portal';

export interface ShapeNodeData extends Record<string, unknown> {
  label: string;
  shapeType: ShapeType;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  imageUrl?: string;
  fontFamily?: 'sans' | 'serif' | 'mono' | 'handwriting';
  locked?: boolean;
  tags?: string[];
  reactions?: Record<string, number>;
  votes?: number;
  assignee?: string;
  dueDate?: string;
  status?: 'todo' | 'in-progress' | 'done';
  svgPath?: string;
  stickerEmoji?: string;
  notes?: string;
  rotation?: number;
  ideaOrbits?: string[];
  portalId?: string;
}

export type ShapeNode = Node<ShapeNodeData, 'shape'>;

export interface DiagramState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
}

export interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | BufferSource | Blob): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

export interface FileSystemFileHandle {
  readonly kind: 'file';
  readonly name: string;
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
  getFile(): Promise<File>;
}

