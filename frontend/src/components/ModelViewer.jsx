import "@google/model-viewer";

export default function ModelViewer({ glbUrl }) {
  if (!glbUrl) {
    return (
      <div className="text-center py-12 text-gray-500">
        No 3D model available
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-gray-800">
      <model-viewer
        src={glbUrl}
        alt="Solar farm 3D model"
        auto-rotate
        camera-controls
        shadow-intensity="1"
        environment-image="neutral"
        style={{ width: "100%", height: "400px", backgroundColor: "#111" }}
      />
    </div>
  );
}
