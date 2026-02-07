import { useState, useCallback, useMemo } from "react";
import Map, { Source, Layer } from "react-map-gl/maplibre";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { useControl } from "react-map-gl/maplibre";
import { PolygonLayer } from "@deck.gl/layers";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAPTILER_KEY } from "../constants";
import { calculateShadowPolygons } from "../utils/shadow-geometry";

// Satellite style with terrain 3D - falls back to free ESRI satellite if no MapTiler key
const MAP_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_KEY}`
  : {
      version: 8,
      name: "Satellite",
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      sources: {
        satellite: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          maxzoom: 19,
          attribution: "Esri, Maxar, Earthstar Geographics",
        },
        terrain: {
          type: "raster-dem",
          tiles: [
            "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          maxzoom: 15,
          encoding: "terrarium",
        },
      },
      layers: [
        {
          id: "satellite",
          type: "raster",
          source: "satellite",
          paint: { "raster-saturation": 0.1, "raster-contrast": 0.1 },
        },
      ],
      terrain: {
        source: "terrain",
        exaggeration: 1.5,
      },
      sky: {},
    };

const INITIAL_VIEW = {
  latitude: 23.7145,
  longitude: -15.9369,
  zoom: 15,
  pitch: 60,
  bearing: -20,
};

function DeckGLOverlay({ layers }) {
  const overlay = useControl(() => new MapboxOverlay({ interleaved: true }));
  overlay.setProps({ layers });
  return null;
}

export default function MapView({
  analysisData,
  isDrawing,
  drawingPoints,
  polygon,
  onMapClick,
  hour,
  month,
}) {
  const [viewState, setViewState] = useState(INITIAL_VIEW);

  const handleClick = useCallback(
    (e) => {
      if (isDrawing && e.lngLat) {
        onMapClick(e.lngLat);
      }
    },
    [isDrawing, onMapClick]
  );

  const panelFeatures = analysisData?.layout?.panels_geojson?.features || [];

  const solarElevation = useMemo(() => {
    const dayOfYear = month * 30;
    const declination = 23.45 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));
    const hourAngle = (hour - 12) * 15;
    const latRad = (23.7 * Math.PI) / 180;
    const decRad = (declination * Math.PI) / 180;
    const haRad = (hourAngle * Math.PI) / 180;
    const sinElev =
      Math.sin(latRad) * Math.sin(decRad) +
      Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
    return (Math.asin(sinElev) * 180) / Math.PI;
  }, [hour, month]);

  const solarAzimuth = useMemo(() => {
    const hourAngle = (hour - 12) * 15;
    return 180 + hourAngle;
  }, [hour]);

  const shadowFeatures = useMemo(() => {
    if (!panelFeatures.length || solarElevation <= 0) return [];
    const sampled = panelFeatures.filter((_, i) => i % 10 === 0);
    return calculateShadowPolygons(
      sampled,
      solarElevation,
      solarAzimuth,
      2.278,
      25
    );
  }, [panelFeatures, solarElevation, solarAzimuth]);

  const layers = useMemo(() => {
    const result = [];

    if (panelFeatures.length) {
      result.push(
        new PolygonLayer({
          id: "panels",
          data: panelFeatures,
          getPolygon: (f) => f.geometry.coordinates,
          getFillColor: [50, 130, 220, 180],
          getLineColor: [30, 80, 160, 255],
          lineWidthMinPixels: 1,
          pickable: true,
        })
      );
    }

    if (shadowFeatures.length) {
      result.push(
        new PolygonLayer({
          id: "shadows",
          data: shadowFeatures,
          getPolygon: (f) => f.geometry.coordinates,
          getFillColor: [20, 20, 40, 100],
          getLineColor: [20, 20, 40, 40],
          lineWidthMinPixels: 0,
        })
      );
    }

    return result;
  }, [panelFeatures, shadowFeatures]);

  const drawingGeoJSON = useMemo(() => {
    if (!drawingPoints.length) return null;
    return {
      type: "Feature",
      geometry: {
        type: drawingPoints.length > 2 ? "Polygon" : "LineString",
        coordinates:
          drawingPoints.length > 2
            ? [[...drawingPoints, drawingPoints[0]]]
            : drawingPoints,
      },
    };
  }, [drawingPoints]);

  const polygonGeoJSON = useMemo(() => {
    if (!polygon) return null;
    return { type: "Feature", geometry: polygon };
  }, [polygon]);

  return (
    <Map
      {...viewState}
      onMove={(e) => setViewState(e.viewState)}
      onClick={handleClick}
      mapStyle={MAP_STYLE}
      style={{ width: "100%", height: "100%" }}
      cursor={isDrawing ? "crosshair" : "grab"}
      terrain={!MAPTILER_KEY ? { source: "terrain", exaggeration: 1.5 } : undefined}
      maxPitch={85}
    >
      <DeckGLOverlay layers={layers} />

      {drawingGeoJSON && (
        <Source type="geojson" data={drawingGeoJSON}>
          <Layer
            type="line"
            paint={{
              "line-color": "#f59e0b",
              "line-width": 2,
              "line-dasharray": [2, 2],
            }}
          />
        </Source>
      )}

      {polygonGeoJSON && (
        <Source type="geojson" data={polygonGeoJSON}>
          <Layer
            type="line"
            paint={{
              "line-color": "#f59e0b",
              "line-width": 3,
            }}
          />
          <Layer
            type="fill"
            paint={{
              "fill-color": "#f59e0b",
              "fill-opacity": 0.08,
            }}
          />
        </Source>
      )}
    </Map>
  );
}
