import { PolygonLayer } from "@deck.gl/layers";
import { irradianceToColor } from "../utils/color-scales";

export function createPanelLayer(panelFeatures, irradianceData = null) {
  return new PolygonLayer({
    id: "panels",
    data: panelFeatures,
    getPolygon: (f) => f.geometry.coordinates,
    getFillColor: (f) => {
      if (irradianceData) {
        const rowIdx = f.properties?.row || 0;
        const irr = irradianceData[rowIdx] || 800;
        return [...irradianceToColor(irr), 180];
      }
      return [50, 130, 220, 180];
    },
    getLineColor: [30, 80, 160, 255],
    lineWidthMinPixels: 1,
    pickable: true,
    updateTriggers: {
      getFillColor: [irradianceData],
    },
  });
}

export default function PanelOverlay() {
  return null;
}
