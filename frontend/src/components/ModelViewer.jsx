import "@google/model-viewer";

export default function ModelViewer({ glbUrl, compact = false }) {
  if (!glbUrl) {
    return (
      <div className="text-center py-4 text-gray-500" style={{ fontSize: compact ? 10 : 14 }}>
        No 3D model
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <model-viewer
        src={glbUrl}
        alt="Solar farm 3D model"
        auto-rotate
        camera-controls
        shadow-intensity="1"
        environment-image="neutral"
        style={{ width: "100%", height: "100%", backgroundColor: "#F0EBE0" }}
      />
      {compact && (
        <div style={{
          position: "absolute", bottom: 4, left: 6,
          fontSize: 8, color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.1em", textTransform: "uppercase",
        }}>
          3D SOLAR FARM MODEL
        </div>
      )}
    </div>
  );
}
