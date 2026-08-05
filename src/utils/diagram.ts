import type { ShapeType } from '../types/diagram';

export function getDefaultNodeDimensions(shapeType: ShapeType): { width: number; height: number } {
  let width = 160;
  let height = 80;

  if (shapeType === 'circle' || shapeType === 'diamond' || shapeType === 'cylinder' || shapeType === 'portal') {
    width = 120;
    height = 120;
  } else if (shapeType === 'sticky' || shapeType === 'image' || shapeType === 'sticker' || shapeType === 'drawing') {
    width = 150;
    height = 150;
  } else if (shapeType === 'text') {
    width = 100;
    height = 40;
  } else if (shapeType === 'frame') {
    width = 400;
    height = 300;
  } else if (shapeType === 'card') {
    width = 220;
    height = 120;
  }

  return { width, height };
}
