export type ScaleMode = 'linear' | 'log' | 'quantile';

/** SVG transform: screen = point * k + [x, y]. */
export interface Transform {
  k: number;
  x: number;
  y: number;
}

/** [[minX, minY], [maxX, maxY]] in projected (pre-transform) pixel space. */
export type BBox = [[number, number], [number, number]];

export interface Viewport {
  width: number;
  height: number;
}
