export default function DrawingTool({
  isDrawing,
  onStartDraw,
  onFinishDraw,
  onReset,
  pointCount,
}) {
  if (!isDrawing) {
    return (
      <button
        onClick={onStartDraw}
        className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-4 py-2 rounded-lg shadow-lg transition"
      >
        Draw Zone
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={onFinishDraw}
        disabled={pointCount < 3}
        className="bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold px-4 py-2 rounded-lg shadow-lg transition"
      >
        Finish ({pointCount} pts)
      </button>
      <button
        onClick={onReset}
        className="bg-red-500 hover:bg-red-400 text-white px-4 py-2 rounded-lg shadow-lg transition"
      >
        Cancel
      </button>
    </div>
  );
}
