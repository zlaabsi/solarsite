import { useState, useCallback } from "react";

export default function useMapDraw() {
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  const [polygon, setPolygon] = useState(null);

  const startDrawing = useCallback(() => {
    setIsDrawing(true);
    setPoints([]);
    setPolygon(null);
  }, []);

  const addPoint = useCallback(
    (lngLat) => {
      if (!isDrawing) return;
      setPoints((prev) => [...prev, [lngLat.lng, lngLat.lat]]);
    },
    [isDrawing]
  );

  const finishDrawing = useCallback(() => {
    if (points.length < 3) return;

    const closed = [...points, points[0]];
    const geojson = {
      type: "Polygon",
      coordinates: [closed],
    };

    setPolygon(geojson);
    setIsDrawing(false);
  }, [points]);

  const resetDrawing = useCallback(() => {
    setIsDrawing(false);
    setPoints([]);
    setPolygon(null);
  }, []);

  return {
    isDrawing,
    points,
    polygon,
    startDrawing,
    addPoint,
    finishDrawing,
    resetDrawing,
  };
}
