import { HeatmapLayer as DeckHeatmapLayer } from "@deck.gl/aggregation-layers";

export function createHeatmapLayer(heatmapData, bounds) {
  if (!heatmapData || !bounds) return null;

  const grid = heatmapData.grid;
  const ny = grid.length;
  const nx = grid[0]?.length || 0;

  const points = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const val = grid[j][i];
      if (val === null || isNaN(val)) continue;
      const lng = bounds.west + ((i + 0.5) / nx) * (bounds.east - bounds.west);
      const lat =
        bounds.south + ((j + 0.5) / ny) * (bounds.north - bounds.south);
      points.push({ position: [lng, lat], weight: val });
    }
  }

  return new DeckHeatmapLayer({
    id: "heatmap",
    data: points,
    getPosition: (d) => d.position,
    getWeight: (d) => d.weight,
    radiusPixels: 30,
    intensity: 1,
    threshold: 0.05,
    colorRange: [
      [0, 0, 200],
      [0, 100, 255],
      [0, 200, 150],
      [100, 255, 0],
      [255, 200, 0],
      [255, 50, 0],
    ],
  });
}

export default function HeatmapLayerCmp() {
  return null;
}
