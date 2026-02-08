import { useState, useCallback, useRef } from "react";

/* ─── Pure geometry helpers ─── */

export function centroid(coords) {
  // coords = [[lng,lat], ...] (4 corners, no closing duplicate)
  const n = Math.min(coords.length, 4);
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += coords[i][0]; sy += coords[i][1]; }
  return [sx / n, sy / n];
}

function translateCoords(coords, dlng, dlat) {
  return coords.map(([x, y]) => [x + dlng, y + dlat]);
}

function scaleFromCenter(coords, factor, center) {
  return coords.map(([x, y]) => [
    center[0] + (x - center[0]) * factor,
    center[1] + (y - center[1]) * factor,
  ]);
}

function rotateCoords(coords, angleRad, center) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return coords.map(([x, y]) => {
    const dx = x - center[0];
    const dy = y - center[1];
    return [
      center[0] + dx * cos - dy * sin,
      center[1] + dx * sin + dy * cos,
    ];
  });
}

function angleTo(center, point) {
  return Math.atan2(point[1] - center[1], point[0] - center[0]);
}

function dist(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/** Close polygon ring: coords[4] = coords[0] */
function closeRing(corners) {
  return [...corners.slice(0, 4), [...corners[0]]];
}

/** Extract 4 corners from a GeoJSON Polygon (drop closing coord) */
function cornersFromPolygon(polygon) {
  if (!polygon?.coordinates?.[0]) return null;
  return polygon.coordinates[0].slice(0, 4).map((c) => [...c]);
}

/* ─── Hook ─── */

export default function usePolygonEdit(sourcePolygon) {
  const [editMode, setEditMode] = useState(null); // null | "translate" | "resize" | "rotate"
  const [editCorners, setEditCorners] = useState(null); // 4 corners during editing
  const [isDragging, setIsDragging] = useState(false);
  const [cumulativeRotationDeg, setCumulativeRotationDeg] = useState(0);

  const dragRef = useRef({
    type: null, // "translate" | "corner" | "rotate"
    cornerIndex: -1,
    startLngLat: null,
    originalCorners: null,
    startAngle: 0,
  });

  const isEditing = editCorners !== null;

  /** Build GeoJSON polygon from current edit corners */
  const editPolygon = editCorners
    ? { type: "Polygon", coordinates: [closeRing(editCorners)] }
    : null;

  /* ── Lifecycle ── */

  const startEdit = useCallback(() => {
    const corners = cornersFromPolygon(sourcePolygon);
    if (!corners) return;
    setEditCorners(corners);
    setEditMode("translate");
    setCumulativeRotationDeg(0);
  }, [sourcePolygon]);

  const cancelEdit = useCallback(() => {
    setEditCorners(null);
    setEditMode(null);
    setIsDragging(false);
    setCumulativeRotationDeg(0);
    dragRef.current = { type: null, cornerIndex: -1, startLngLat: null, originalCorners: null, startAngle: 0 };
  }, []);

  const commitEdit = useCallback(() => {
    if (!editCorners) return null;
    const polygon = { type: "Polygon", coordinates: [closeRing(editCorners)] };
    const azimuthDeg = ((180 + cumulativeRotationDeg) % 360 + 360) % 360;
    setEditCorners(null);
    setEditMode(null);
    setIsDragging(false);
    dragRef.current = { type: null, cornerIndex: -1, startLngLat: null, originalCorners: null, startAngle: 0 };
    return { polygon, azimuthDeg };
  }, [editCorners, cumulativeRotationDeg]);

  /* ── Pointer handlers ── */

  const handlePointerDown = useCallback(
    (lngLat, target) => {
      // target: "polygon" | "corner:0" | "corner:1" | ... | "rotate"
      if (!editCorners || !editMode) return;

      const orig = editCorners.map((c) => [...c]);

      if (target === "rotate") {
        const c = centroid(orig);
        dragRef.current = {
          type: "rotate",
          cornerIndex: -1,
          startLngLat: lngLat,
          originalCorners: orig,
          startAngle: angleTo(c, [lngLat.lng, lngLat.lat]),
        };
      } else if (typeof target === "string" && target.startsWith("corner:")) {
        const idx = parseInt(target.split(":")[1], 10);
        dragRef.current = {
          type: "corner",
          cornerIndex: idx,
          startLngLat: lngLat,
          originalCorners: orig,
          startAngle: 0,
        };
      } else {
        // polygon body → translate
        dragRef.current = {
          type: "translate",
          cornerIndex: -1,
          startLngLat: lngLat,
          originalCorners: orig,
          startAngle: 0,
        };
      }

      setIsDragging(true);
    },
    [editCorners, editMode]
  );

  const handlePointerMove = useCallback(
    (lngLat) => {
      const d = dragRef.current;
      if (!d.type || !d.originalCorners) return;

      if (d.type === "translate") {
        const dlng = lngLat.lng - d.startLngLat.lng;
        const dlat = lngLat.lat - d.startLngLat.lat;
        setEditCorners(translateCoords(d.originalCorners, dlng, dlat));
      } else if (d.type === "corner") {
        const c = centroid(d.originalCorners);
        const origDist = dist(c, d.originalCorners[d.cornerIndex]);
        const newDist = dist(c, [lngLat.lng, lngLat.lat]);
        const factor = Math.max(0.1, origDist > 0 ? newDist / origDist : 1);
        setEditCorners(scaleFromCenter(d.originalCorners, factor, c));
      } else if (d.type === "rotate") {
        const c = centroid(d.originalCorners);
        const currentAngle = angleTo(c, [lngLat.lng, lngLat.lat]);
        const deltaAngle = currentAngle - d.startAngle;
        setEditCorners(rotateCoords(d.originalCorners, deltaAngle, c));
      }
    },
    []
  );

  const handlePointerUp = useCallback(() => {
    const d = dragRef.current;
    if (d.type === "rotate" && d.originalCorners && editCorners) {
      const c = centroid(d.originalCorners);
      const origAngle = angleTo(c, [d.startLngLat.lng, d.startLngLat.lat]);
      // Compute delta from original corners to current edit corners
      // Use first corner as reference
      const newAngle = angleTo(centroid(editCorners), editCorners[0]);
      const origRef = angleTo(centroid(d.originalCorners), d.originalCorners[0]);
      const delta = ((newAngle - origRef) * 180) / Math.PI;
      setCumulativeRotationDeg((prev) => prev + delta);
    }
    dragRef.current = { type: null, cornerIndex: -1, startLngLat: null, originalCorners: null, startAngle: 0 };
    setIsDragging(false);
  }, [editCorners]);

  return {
    // State
    editPolygon,
    editCorners,
    isEditing,
    editMode,
    isDragging,
    cumulativeRotationDeg,
    // Actions
    startEdit,
    cancelEdit,
    commitEdit,
    setEditMode,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
