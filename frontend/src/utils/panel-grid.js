export function generatePanelGrid(
  polygonCoords,
  moduleWidthM = 1.134,
  moduleHeightM = 2.278,
  rowSpacingM = 3.0,
  latitude = 0
) {
  const latScale = 111320;
  const lonScale = 111320 * Math.cos((latitude * Math.PI) / 180);

  const lngs = polygonCoords.map((c) => c[0]);
  const lats = polygonCoords.map((c) => c[1]);

  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const widthM = (maxLng - minLng) * lonScale;
  const heightM = (maxLat - minLat) * latScale;

  const nCols = Math.floor(widthM / moduleWidthM);
  const nRows = Math.floor(heightM / (moduleHeightM + rowSpacingM));

  const panels = [];
  for (let row = 0; row < nRows; row++) {
    const yM = row * (moduleHeightM + rowSpacingM);
    const lat0 = minLat + yM / latScale;
    const lat1 = minLat + (yM + moduleHeightM) / latScale;

    for (let col = 0; col < nCols; col++) {
      const xM = col * moduleWidthM;
      const lng0 = minLng + xM / lonScale;
      const lng1 = minLng + (xM + moduleWidthM) / lonScale;

      panels.push({
        type: "Feature",
        properties: { row, col },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [lng0, lat0],
              [lng1, lat0],
              [lng1, lat1],
              [lng0, lat1],
              [lng0, lat0],
            ],
          ],
        },
      });
    }
  }

  return { type: "FeatureCollection", features: panels, nRows, nCols };
}
