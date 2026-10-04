export const TILE_W = 64;
export const TILE_H = 32;

export function worldToScreen(wx, wy) {
  return {
    x: (wx - wy) * (TILE_W / 2),
    y: (wx + wy) * (TILE_H / 2),
  };
}

export function screenToWorld(sx, sy) {
  return {
    x: (sx / (TILE_W / 2) + sy / (TILE_H / 2)) / 2,
    y: (sy / (TILE_H / 2) - sx / (TILE_W / 2)) / 2,
  };
}