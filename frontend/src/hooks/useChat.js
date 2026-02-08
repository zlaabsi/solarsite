import { useState, useCallback, useRef } from "react";
import { API_URL } from "../constants";

let msgId = 0;

export default function useChat({ onAction } = {}) {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const abortRef = useRef(null);
  const wsRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);

  /* ── Strip large fields from analysis before sending ── */
  const compactAnalysis = (data) => {
    if (!data) return null;
    const compact = {};
    for (const [key, val] of Object.entries(data)) {
      if (
        key === "heatmap_summer" ||
        key === "heatmap_winter" ||
        key === "panels_geojson"
      )
        continue;
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const inner = {};
        for (const [k, v] of Object.entries(val)) {
          if (
            k === "heatmap_summer" ||
            k === "heatmap_winter" ||
            k === "panels_geojson"
          )
            continue;
          inner[k] = v;
        }
        compact[key] = inner;
      } else {
        compact[key] = val;
      }
    }
    return compact;
  };

  /* ── Send text message via POST /api/chat (SSE) ── */
  const sendMessage = useCallback(
    async (text, analysisData) => {
      if (!text.trim() || isStreaming) return;

      const userMsg = {
        id: ++msgId,
        role: "user",
        content: text.trim(),
      };
      const assistantMsg = {
        id: ++msgId,
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const abort = new AbortController();
      abortRef.current = abort;

      // Build history from existing messages (excluding the new ones)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const res = await fetch(`${API_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            history,
            analysis_data: compactAnalysis(analysisData),
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

              if (event.type === "token") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: m.content + event.content }
                      : m
                  )
                );
              } else if (event.type === "done") {
                // Replace with clean display text (ACTION: stripped by backend)
                if (event.content) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsg.id
                        ? { ...m, content: event.content }
                        : m
                    )
                  );
                }
                if (event.action && onAction) {
                  onAction(event.action);
                }
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: "Connection error. Please try again." }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, isStreaming, onAction]
  );

  /* ── Voice: STT via Gradium WebSocket (stt_only mode) ── */
  const startListening = useCallback(
    async (onTranscript) => {
      if (isListening) return;

      const wsUrl = API_URL.replace("http", "ws") + "/ws/voice";
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Set stt_only mode — skip GPT-5-nano + TTS
        ws.send(JSON.stringify({ type: "set_mode", stt_only: true }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "transcript" && msg.text) {
          onTranscript?.(msg.text);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
      };

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        streamRef.current = mediaStream;

        const recorder = new MediaRecorder(mediaStream, {
          mimeType: "audio/webm",
        });
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result.split(",")[1];
              ws.send(JSON.stringify({ type: "audio", data: base64 }));
            };
            reader.readAsDataURL(e.data);
          }
        };

        recorder.start(100);
        setIsListening(true);
      } catch {
        ws.close();
        setIsListening(false);
      }
    },
    [isListening]
  );

  const stopListening = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsListening(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isStreaming,
    isListening,
    sendMessage,
    startListening,
    stopListening,
    clearMessages,
  };
}
