import type { ShapeType } from '../types/diagram';

export interface TemplateNode {
  id: string;
  shapeType: ShapeType;
  label: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  fontSize?: number;
  bold?: boolean;
}

export interface TemplateEdge {
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  style?: { stroke?: string; strokeWidth?: number };
  markerType?: 'directed' | 'bidirectional' | 'undirected';
}

export interface Template {
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

export const mindmapTemplate: Template = {
  nodes: [
    { id: 'central', shapeType: 'rectangle', label: 'Central Idea', x: 200, y: 200, width: 160, height: 80, color: '#bfdbfe', borderColor: '#3b82f6', borderWidth: 3, fontSize: 16, bold: true },
    { id: 'branch1', shapeType: 'rectangle', label: 'Research & Planning', x: 450, y: 80, width: 150, height: 60, color: '#fef08a', borderColor: '#eab308', borderWidth: 2 },
    { id: 'branch2', shapeType: 'rectangle', label: 'Design System', x: 450, y: 210, width: 150, height: 60, color: '#bbf7d0', borderColor: '#22c55e', borderWidth: 2 },
    { id: 'branch3', shapeType: 'rectangle', label: 'Core Execution', x: 450, y: 340, width: 150, height: 60, color: '#c7d2fe', borderColor: '#6366f1', borderWidth: 2 },
    { id: 'sub1', shapeType: 'sticky', label: 'User Interviews', x: 680, y: 50, width: 120, height: 50, color: '#ffffff', borderColor: '#cbd5e1' },
    { id: 'sub2', shapeType: 'sticky', label: 'Color Palette', x: 680, y: 180, width: 120, height: 50, color: '#ffffff', borderColor: '#cbd5e1' },
  ],
  edges: [
    { source: 'central', target: 'branch1', markerType: 'directed', style: { stroke: '#3b82f6', strokeWidth: 2 } },
    { source: 'central', target: 'branch2', markerType: 'directed', style: { stroke: '#3b82f6', strokeWidth: 2 } },
    { source: 'central', target: 'branch3', markerType: 'directed', style: { stroke: '#3b82f6', strokeWidth: 2 } },
    { source: 'branch1', target: 'sub1', markerType: 'directed', style: { stroke: '#eab308', strokeWidth: 2 } },
    { source: 'branch2', target: 'sub2', markerType: 'directed', style: { stroke: '#22c55e', strokeWidth: 2 } },
  ],
};

export const flowchartTemplate: Template = {
  nodes: [
    { id: 'start', shapeType: 'circle', label: 'Start Process', x: 250, y: 50, width: 100, height: 100, color: '#bbf7d0', borderColor: '#22c55e', borderWidth: 2, bold: true },
    { id: 'input', shapeType: 'rectangle', label: 'Enter Credentials', x: 220, y: 200, width: 160, height: 70, color: '#ffffff', borderColor: '#94a3b8', borderWidth: 2 },
    { id: 'check', shapeType: 'diamond', label: 'Is Valid?', x: 240, y: 320, width: 120, height: 120, color: '#fef08a', borderColor: '#eab308', borderWidth: 2 },
    { id: 'success', shapeType: 'rectangle', label: 'Access Granted\nRedirect to Home', x: 100, y: 500, width: 160, height: 75, color: '#bfdbfe', borderColor: '#3b82f6', borderWidth: 2 },
    { id: 'fail', shapeType: 'rectangle', label: 'Show Error Message\nRetry login', x: 380, y: 500, width: 160, height: 75, color: '#fecaca', borderColor: '#ef4444', borderWidth: 2 },
  ],
  edges: [
    { source: 'start', target: 'input', markerType: 'directed' },
    { source: 'input', target: 'check', markerType: 'directed' },
    { source: 'check', target: 'success', label: 'Yes', markerType: 'directed', style: { stroke: '#22c55e' } },
    { source: 'check', target: 'fail', label: 'No', markerType: 'directed', style: { stroke: '#ef4444' } },
  ],
};

export const databaseTemplate: Template = {
  nodes: [
    { id: 'users', shapeType: 'cylinder', label: 'users\n---\n+ id: uuid\n* email: string\n* name: string', x: 100, y: 150, width: 150, height: 150, color: '#ffffff', borderColor: '#3b82f6', borderWidth: 2, fontSize: 13 },
    { id: 'posts', shapeType: 'cylinder', label: 'posts\n---\n+ id: uuid\n# user_id: uuid\n* title: string\n* body: text', x: 380, y: 150, width: 150, height: 150, color: '#ffffff', borderColor: '#10b981', borderWidth: 2, fontSize: 13 },
    { id: 'comments', shapeType: 'cylinder', label: 'comments\n---\n+ id: uuid\n# post_id: uuid\n# user_id: uuid\n* content: string', x: 660, y: 150, width: 150, height: 150, color: '#ffffff', borderColor: '#8b5cf6', borderWidth: 2, fontSize: 13 },
  ],
  edges: [
    { source: 'users', target: 'posts', label: '1 : N', markerType: 'bidirectional', style: { stroke: '#3b82f6' } },
    { source: 'posts', target: 'comments', label: '1 : N', markerType: 'bidirectional', style: { stroke: '#10b981' } },
    { source: 'users', target: 'comments', label: '1 : N', markerType: 'directed', style: { stroke: '#8b5cf6', strokeWidth: 1.5 }, animated: true },
  ],
};

export const templates: Record<string, Template> = {
  mindmap: mindmapTemplate,
  flowchart: flowchartTemplate,
  database: databaseTemplate,
};
