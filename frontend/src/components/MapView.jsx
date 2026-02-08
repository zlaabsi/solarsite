import { useState, useCallback, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import Map, { Source, Layer, Marker } from "react-map-gl/maplibre";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { useControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAPTILER_KEY } from "../constants";
import { centroid } from "../hooks/usePolygonEdit";
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

const MapView = forwardRef(function MapView({
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
  /* Polygon edit props */
  isEditing = false,
  editPolygon = null,
  editCorners = null,
  editMode = null,
  isDragEditing = false,
  onEditPointerDown,
  onEditPointerMove,
  onEditPointerUp,
}, ref) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_3D);
  const mapRef = useRef(null);

  useImperativeHandle(ref, () => ({
    captureScreenshot: () => {
      const map = mapRef.current?.getMap();
      if (!map) {
        console.warn("[MapView] captureScreenshot: map not ready");
        return Promise.resolve(null);
      }

      return new Promise((resolve) => {
        // Safety timeout — resolve null if render event never fires
        const timeout = setTimeout(() => {
          console.warn("[MapView] captureScreenshot: render event timed out, trying direct capture");
          try {
            const canvas = map.getCanvas();
            const dataUrl = canvas.toDataURL("image/png");
            resolve(dataUrl.split(",")[1]);
          } catch {
            resolve(null);
          }
        }, 3000);

        map.triggerRepaint();
        map.once("render", () => {
          clearTimeout(timeout);
          try {
            const canvas = map.getCanvas();
            const dataUrl = canvas.toDataURL("image/png");
            console.log("[MapView] Screenshot captured via render event");
            resolve(dataUrl.split(",")[1]);
          } catch (err) {
            console.error("[MapView] toDataURL failed:", err);
            resolve(null);
          }
        });
      });
    },
  }));

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

  const siteLatitude = useMemo(() => {
    if (analysisData?.site_info?.latitude) return analysisData.site_info.latitude;
    if (polygon?.coordinates?.[0]) {
      const coords = polygon.coordinates[0];
      return coords.reduce((s, c) => s + c[1], 0) / coords.length;
    }
    return 23.7145;
  }, [analysisData, polygon]);

  const solarElevation = useMemo(() => {
    const dayOfYear = month * 30;
    const declination = 23.45 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));
    const hourAngle = (hour - 12) * 15;
    const latRad = (siteLatitude * Math.PI) / 180;
    const decRad = (declination * Math.PI) / 180;
    const haRad = (hourAngle * Math.PI) / 180;
    const sinElev =
      Math.sin(latRad) * Math.sin(decRad) +
      Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
    return (Math.asin(sinElev) * 180) / Math.PI;
  }, [hour, month, siteLatitude]);

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
      25,
      siteLatitude
    );
  }, [panelFeatures, solarElevation, solarAzimuth, siteLatitude]);

  /* ─── Heatmap data ─── */
  const heatmapData = useMemo(() => {
    if (!showHeatmap || !analysisData?.heatmaps) return null;
    const season = analysisData.heatmaps[heatmapSeason];
    if (!season) return null;
    return { grid: season.grid, bounds: season.bounds };
  }, [showHeatmap, heatmapSeason, analysisData]);

  /* ─── Edit mode: disable map drag while dragging handles ─── */
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (isDragEditing) {
      map.dragPan.disable();
    } else {
      map.dragPan.enable();
    }
  }, [isDragEditing]);

  /* ─── Edit polygon GeoJSON ─── */
  const editPolygonGeoJSON = useMemo(() => {
    if (!isEditing || !editPolygon) return null;
    return { type: "Feature", geometry: editPolygon };
  }, [isEditing, editPolygon]);

  /* ─── Edit handles data ─── */
  const editHandles = useMemo(() => {
    if (!isEditing || !editCorners || editCorners.length < 4) return { corners: [], rotationHandle: null, center: null };
    const center = centroid(editCorners);
    // Rotation handle: offset above centroid (north) by ~30% of polygon height
    const lats = editCorners.map((c) => c[1]);
    const maxLat = Math.max(...lats);
    const span = maxLat - Math.min(...lats);
    const rotationHandle = [center[0], maxLat + Math.max(span * 0.35, 0.0003)];
    return { corners: editCorners.slice(0, 4), rotationHandle, center };
  }, [isEditing, editCorners]);

  /* ─── Connector line from centroid to rotation handle ─── */
  const connectorGeoJSON = useMemo(() => {
    if (!editHandles.center || !editHandles.rotationHandle) return null;
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [editHandles.center, editHandles.rotationHandle],
      },
    };
  }, [editHandles]);

  /* ─── Cursor logic ─── */
  const mapCursor = useMemo(() => {
    if (isDrawing) return "crosshair";
    if (isEditing && isDragEditing) {
      if (editMode === "rotate") return "crosshair";
      if (editMode === "resize") return "nwse-resize";
      return "move";
    }
    if (isEditing) return "default";
    return "grab";
  }, [isDrawing, isEditing, isDragEditing, editMode]);

  /* ─── Map mouse events for translate drag ─── */
  const handleMouseDown = useCallback(
    (e) => {
      if (!isEditing || editMode !== "translate") return;
      if (e.originalEvent?.button !== 0) return;
      // Check if click is within the edit polygon — approximate by checking distance
      // For simplicity, treat any click on the map body (not handles) as a translate start
      onEditPointerDown?.(e.lngLat, "polygon");
    },
    [isEditing, editMode, onEditPointerDown]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragEditing) return;
      onEditPointerMove?.(e.lngLat);
    },
    [isDragEditing, onEditPointerMove]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragEditing) return;
    onEditPointerUp?.();
  }, [isDragEditing, onEditPointerUp]);

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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      mapStyle={SATELLITE_STYLE}
      preserveDrawingBuffer={true}
      style={{ width: "100%", height: "100%" }}
      cursor={mapCursor}
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

      {polygonGeoJSON && !isEditing && (
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

      {/* ── Edit polygon (dashed) ── */}
      {editPolygonGeoJSON && (
        <Source type="geojson" data={editPolygonGeoJSON}>
          <Layer
            type="line"
            paint={{
              "line-color": "#e05438",
              "line-width": 2.5,
              "line-dasharray": [4, 3],
            }}
          />
          <Layer
            type="fill"
            paint={{
              "fill-color": "#e05438",
              "fill-opacity": 0.18,
            }}
          />
        </Source>
      )}

      {/* ── Connector line: centroid → rotation handle ── */}
      {connectorGeoJSON && (
        <Source type="geojson" data={connectorGeoJSON}>
          <Layer
            type="line"
            paint={{
              "line-color": "#22c55e",
              "line-width": 1,
              "line-dasharray": [4, 3],
            }}
          />
        </Source>
      )}

      {/* ── Corner resize handles ── */}
      {isEditing &&
        editHandles.corners.map((corner, i) => (
          <Marker
            key={`corner-${i}`}
            longitude={corner[0]}
            latitude={corner[1]}
            anchor="center"
          >
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                // Build a synthetic lngLat
                onEditPointerDown?.({ lng: corner[0], lat: corner[1] }, `corner:${i}`);
              }}
              style={{
                width: 12,
                height: 12,
                background: "#e05438",
                border: "2px solid #fff",
                cursor: "nwse-resize",
                boxShadow: "0 0 6px rgba(0,0,0,0.5)",
              }}
            />
          </Marker>
        ))}

      {/* ── Rotation handle ── */}
      {isEditing && editHandles.rotationHandle && (
        <Marker
          longitude={editHandles.rotationHandle[0]}
          latitude={editHandles.rotationHandle[1]}
          anchor="center"
        >
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              onEditPointerDown?.(
                { lng: editHandles.rotationHandle[0], lat: editHandles.rotationHandle[1] },
                "rotate"
              );
            }}
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#22c55e",
              border: "2px solid #fff",
              cursor: "crosshair",
              boxShadow: "0 0 8px rgba(34,197,94,0.6), 0 0 4px rgba(0,0,0,0.4)",
            }}
          />
        </Marker>
      )}
    </Map>
  );
});

export default MapView;

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
