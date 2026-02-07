import { PolygonLayer } from "@deck.gl/layers";

export function createShadowLayer(shadowFeatures) {
  return new PolygonLayer({
    id: "shadows",
    data: shadowFeatures,
    getPolygon: (f) => f.geometry.coordinates,
    getFillColor: [20, 20, 40, 100],
    getLineColor: [20, 20, 40, 40],
    lineWidthMinPixels: 0,
    transitions: {
      getPolygon: 300,
    },
  });
}

export default function ShadowRenderer() {
  return null;
}
