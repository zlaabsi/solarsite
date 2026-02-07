import { useState, useEffect } from "react";
import MapView from "./components/MapView";
import Dashboard from "./components/Dashboard";
import TimeSlider from "./components/TimeSlider";
import VoiceControl from "./components/VoiceControl";
import ModelViewer from "./components/ModelViewer";
import ReportPanel from "./components/ReportPanel";
import AgentPanel from "./components/AgentPanel";
import useAgent from "./hooks/useAgent";
import { DEFAULT_LAT, DEFAULT_LON } from "./constants";

export default function App() {
  const {
    agentState,
    steps,
    polygon,
    analysisData,
    model3D,
    thinking,
    error,
    runAgent,
    stopAgent,
  } = useAgent();

  const [hour, setHour] = useState(12);
  const [month, setMonth] = useState(6);
  const [activeView, setActiveView] = useState("map");
  const [mode, setMode] = useState("test"); // "test" (SAM) or "demo" (Hunyuan)

  const handleLaunchAgent = () => {
    runAgent(DEFAULT_LAT, DEFAULT_LON, 5.0, mode);
  };

  useEffect(() => {
    if (model3D) {
      setActiveView("3d");
    }
  }, [model3D]);

  return (
    <div className="w-screen h-screen flex bg-gray-950 text-white overflow-hidden">
      {/* Main map area */}
      <div className="flex-1 relative">
        <MapView
          analysisData={analysisData}
          isDrawing={false}
          drawingPoints={[]}
          polygon={polygon}
          onMapClick={() => {}}
          hour={hour}
          month={month}
        />

        {/* Agent status overlay */}
        {agentState === "running" && (
          <div className="absolute top-4 left-4 z-10 bg-black/80 backdrop-blur-sm text-amber-400 px-4 py-2 rounded-lg flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            AI Agent working...
          </div>
        )}

        {/* Time slider */}
        {analysisData && (
          <div className="absolute bottom-4 left-4 right-[380px] z-10">
            <TimeSlider
              hour={hour}
              month={month}
              onHourChange={setHour}
              onMonthChange={setMonth}
            />
          </div>
        )}

        {/* Error display */}
        {error && agentState !== "error" && (
          <div className="absolute top-4 right-96 z-10 bg-red-900/80 text-red-200 px-4 py-2 rounded-lg">
            Error: {error}
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <div className="w-[360px] bg-gray-900 border-l border-gray-800 flex flex-col overflow-y-auto">
        {/* Navigation tabs */}
        <div className="flex border-b border-gray-800">
          {["map", "3d", "report"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveView(tab)}
              className={`flex-1 py-3 text-sm font-medium capitalize transition ${
                activeView === tab
                  ? "text-amber-400 border-b-2 border-amber-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab === "3d" ? "3D Model" : tab}
            </button>
          ))}
        </div>

        {activeView === "map" && (
          <>
            <AgentPanel
              agentState={agentState}
              steps={steps}
              thinking={thinking}
              error={error}
              mode={mode}
              onModeChange={setMode}
              onLaunch={handleLaunchAgent}
              onStop={stopAgent}
            />
            {analysisData && (
              <>
                <Dashboard data={analysisData} onGenerate3D={() => {}} />
                <VoiceControl analysisData={analysisData} />
              </>
            )}
          </>
        )}

        {activeView === "3d" && (
          <div className="p-4">
            {model3D ? (
              <ModelViewer glbUrl={model3D.model_glb_url} />
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>Launch the AI agent to generate a 3D model</p>
              </div>
            )}
          </div>
        )}

        {activeView === "report" && <ReportPanel data={analysisData} />}
      </div>
    </div>
  );
}
