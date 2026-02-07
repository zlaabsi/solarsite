const TOOL_LABELS = {
  select_zone: "Selecting optimal zone",
  run_solar_analysis: "Running solar analysis",
  generate_3d_visualization: "Generating 3D model",
};

export default function AgentPanel({
  agentState,
  steps,
  thinking,
  error,
  onLaunch,
  onStop,
}) {
  return (
    <div className="p-4 space-y-4">
      {agentState === "idle" && (
        <div className="text-center space-y-3">
          <p className="text-sm text-gray-400">
            AI agent will autonomously select a zone, run solar analysis, and
            generate a 3D model.
          </p>
          <button
            onClick={onLaunch}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold py-3 px-6 rounded-xl shadow-lg transition text-lg"
          >
            Launch AI Assessment
          </button>
        </div>
      )}

      {agentState === "running" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse" />
              Agent Running
            </div>
            <button
              onClick={onStop}
              className="text-xs text-gray-500 hover:text-red-400 transition"
            >
              Stop
            </button>
          </div>

          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {step.status === "running" ? (
                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
              ) : (
                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[10px] shrink-0">
                  &#10003;
                </div>
              )}
              <span
                className={
                  step.status === "done" ? "text-green-400" : "text-gray-300"
                }
              >
                {TOOL_LABELS[step.tool] || step.tool}
              </span>
            </div>
          ))}

          {thinking && (
            <div className="text-xs text-gray-500 italic mt-2 max-h-20 overflow-y-auto leading-relaxed">
              {thinking}
            </div>
          )}
        </div>
      )}

      {agentState === "done" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-400 font-semibold">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            Assessment Complete
          </div>
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[10px] shrink-0">
                &#10003;
              </div>
              <span className="text-green-400">
                {TOOL_LABELS[step.tool] || step.tool}
              </span>
            </div>
          ))}
          <button
            onClick={onLaunch}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition text-sm mt-2"
          >
            Run Again
          </button>
        </div>
      )}

      {agentState === "error" && (
        <div className="space-y-3">
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">
            {error}
          </div>
          <button
            onClick={onLaunch}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-medium py-2 px-4 rounded-lg transition text-sm"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
