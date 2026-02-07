export function calculateShadowPolygons(
  panelFeatures,
  solarElevationDeg,
  solarAzimuthDeg,
  panelHeightM,
  panelTiltDeg,
  latitude = 0
) {
  if (solarElevationDeg <= 0) return [];

  const tiltRad = (panelTiltDeg * Math.PI) / 180;
  const elevRad = (solarElevationDeg * Math.PI) / 180;

  const effectiveHeight = panelHeightM * Math.sin(tiltRad);
  const shadowLength = effectiveHeight / Math.tan(elevRad);
  const shadowAzimuth = (solarAzimuthDeg + 180) % 360;

  const shadowAziRad = (shadowAzimuth * Math.PI) / 180;
  const dx = shadowLength * Math.sin(shadowAziRad);
  const dy = shadowLength * Math.cos(shadowAziRad);

  const latRad = (latitude * Math.PI) / 180;
  const dxDeg = dx / (111320 * Math.cos(latRad));
  const dyDeg = dy / 111320;

  return panelFeatures.map((feature) => {
    const coords = feature.geometry.coordinates[0];
    const shadowCoords = coords.map((c) => [c[0] + dxDeg, c[1] + dyDeg]);
    return {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [coords.concat(shadowCoords.reverse())],
      },
    };
  });
}
