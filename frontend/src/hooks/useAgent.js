import { useState, useCallback, useRef } from "react";
import { API_URL } from "../constants";

export default function useAgent() {
  const [agentState, setAgentState] = useState("idle");
  const [steps, setSteps] = useState([]);
  const [polygon, setPolygon] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [model3D, setModel3D] = useState(null);
  const [thinking, setThinking] = useState("");
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const runAgent = useCallback(
    async (latitude, longitude, areaHectares = 5.0, mode = "test") => {
      setAgentState("running");
      setSteps([]);
      setPolygon(null);
      setAnalysisData(null);
      setModel3D(null);
      setThinking("");
      setError(null);

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const res = await fetch(`${API_URL}/api/agent/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude,
            longitude,
            area_hectares: areaHectares,
            mode,
          }),
          signal: abort.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              switch (event.type) {
                case "thinking":
                  setThinking((prev) => prev + event.content);
                  break;

                case "tool_start":
                  setSteps((prev) => {
                    // Prevent duplicate entries if agent retries the same tool
                    if (prev.some((s) => s.tool === event.tool)) {
                      return prev.map((s) =>
                        s.tool === event.tool ? { ...s, status: "running" } : s
                      );
                    }
                    return [...prev, { tool: event.tool, status: "running" }];
                  });
                  setThinking("");
                  break;

                case "polygon":
                  setPolygon(event.data);
                  setSteps((prev) =>
                    prev.map((s) =>
                      s.tool === "select_zone" ? { ...s, status: "done" } : s
                    )
                  );
                  break;

                case "analysis":
                  setAnalysisData(event.data);
                  setSteps((prev) =>
                    prev.map((s) =>
                      s.tool === "run_solar_analysis"
                        ? { ...s, status: "done" }
                        : s
                    )
                  );
                  break;

                case "model_3d":
                  setModel3D(event.data);
                  setSteps((prev) =>
                    prev.map((s) =>
                      s.tool === "generate_3d_visualization"
                        ? { ...s, status: "done" }
                        : s
                    )
                  );
                  break;

                case "error":
                  setError(event.message);
                  setAgentState("error");
                  break;

                case "done":
                  setAgentState("done");
                  break;
              }
            } catch {
              // ignore parse errors for partial chunks
            }
          }
        }

        setAgentState((prev) => (prev === "error" ? "error" : "done"));
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
          setAgentState("error");
        }
      }
    },
    []
  );

  const stopAgent = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setAgentState("idle");
  }, []);

  return {
    agentState,
    steps,
    polygon,
    analysisData,
    model3D,
    thinking,
    error,
    runAgent,
    stopAgent,
  };
}
