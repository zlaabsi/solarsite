import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Map, { Source, Layer, Marker } from "react-map-gl/maplibre";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { useControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAPTILER_KEY } from "../constants";
import { calculateShadowPolygons } from "../utils/shadow-geometry";
import { createPanelLayer } from "./PanelOverlay";
import { createShadowLayer } from "./ShadowRenderer";
import { createHeatmapLayer } from "./HeatmapLayer";

/* ─── Map styles ─── */

// Satellite (default)
const SATELLITE_STYLE = MAPTILER_KEY
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
      },
      layers: [
        {
          id: "satellite",
          type: "raster",
          source: "satellite",
          paint: { "raster-saturation": 0.1, "raster-contrast": 0.1 },
        },
      ],
    };

const INITIAL_VIEW_3D = {
  latitude: 23.7145,
  longitude: -15.9369,
  zoom: 15,
  pitch: 60,
  bearing: -20,
};

const INITIAL_VIEW_2D = {
  latitude: 23.7145,
  longitude: -15.9369,
  zoom: 15,
  pitch: 0,
  bearing: 0,
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
  is3D,
  onToggle3D,
  showHeatmap = false,
  heatmapSeason = "summer",
}) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_3D);
  const mapRef = useRef(null);

  /* ─── Animate 2D/3D transitions ─── */
  useEffect(() => {
    const target = is3D ? INITIAL_VIEW_3D : INITIAL_VIEW_2D;
    setViewState((prev) => ({
      ...prev,
      pitch: target.pitch,
      bearing: target.bearing,
    }));
  }, [is3D]);

  /* ─── Enable/disable terrain when map loads or 3D toggles ─── */
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Add MapTiler Terrain RGB source if available
    if (MAPTILER_KEY && !map.getSource("maptiler-terrain")) {
      map.addSource("maptiler-terrain", {
        type: "raster-dem",
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`,
        tileSize: 256,
      });
    }

    // Fallback terrain source
    if (!MAPTILER_KEY && !map.getSource("terrain-fallback")) {
      map.addSource("terrain-fallback", {
        type: "raster-dem",
        tiles: [
          "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        maxzoom: 15,
        encoding: "terrarium",
      });
    }

    updateTerrain(map, is3D);
  }, [is3D]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (map && map.isStyleLoaded()) {
      updateTerrain(map, is3D);
    }
  }, [is3D]);

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

  /* ─── Heatmap data ─── */
  const heatmapData = useMemo(() => {
    if (!showHeatmap || !analysisData?.heatmaps) return null;
    const season = analysisData.heatmaps[heatmapSeason];
    if (!season) return null;
    return { grid: season.grid, bounds: season.bounds };
  }, [showHeatmap, heatmapSeason, analysisData]);

  const layers = useMemo(() => {
    const result = [];

    if (panelFeatures.length) {
      result.push(createPanelLayer(panelFeatures));
    }

    if (shadowFeatures.length) {
      result.push(createShadowLayer(shadowFeatures));
    }

    if (heatmapData) {
      const hLayer = createHeatmapLayer(heatmapData, heatmapData.bounds);
      if (hLayer) result.push(hLayer);
    }

    return result;
  }, [panelFeatures, shadowFeatures, heatmapData]);

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
      ref={mapRef}
      {...viewState}
      onMove={(e) => setViewState(e.viewState)}
      onClick={handleClick}
      onLoad={handleMapLoad}
      mapStyle={SATELLITE_STYLE}
      style={{ width: "100%", height: "100%" }}
      cursor={isDrawing ? "crosshair" : "grab"}
      maxPitch={85}
    >
      <DeckGLOverlay layers={layers} />

      {drawingGeoJSON && (
        <Source type="geojson" data={drawingGeoJSON}>
          <Layer
            type="line"
            paint={{
              "line-color": "#e05438",
              "line-width": 3,
              "line-dasharray": [3, 2],
            }}
          />
        </Source>
      )}

      {/* Drawing vertex markers */}
      {drawingPoints.map((pt, i) => (
        <Marker key={i} longitude={pt[0]} latitude={pt[1]} anchor="center">
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: i === 0 ? "#22c55e" : "#e05438",
              border: "2.5px solid #fff",
              boxShadow: "0 0 8px rgba(0,0,0,0.5), 0 0 16px rgba(224,84,56,0.4)",
              cursor: "pointer",
            }}
          />
        </Marker>
      ))}

      {polygonGeoJSON && (
        <Source type="geojson" data={polygonGeoJSON}>
          <Layer
            type="line"
            paint={{
              "line-color": "#e05438",
              "line-width": 3,
            }}
          />
          <Layer
            type="fill"
            paint={{
              "fill-color": "#e05438",
              "fill-opacity": 0.12,
            }}
          />
        </Source>
      )}
    </Map>
  );
}

/* ─── Helper: toggle terrain on/off ─── */
function updateTerrain(map, enable) {
  try {
    if (enable) {
      const src = map.getSource("maptiler-terrain") ? "maptiler-terrain" : "terrain-fallback";
      if (map.getSource(src)) {
        map.setTerrain({ source: src, exaggeration: 1.5 });
      }
    } else {
      map.setTerrain(null);
    }
  } catch {
    // terrain not ready yet
  }
}
