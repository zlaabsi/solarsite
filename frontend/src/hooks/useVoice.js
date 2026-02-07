import { useState, useRef, useCallback } from "react";
import { API_URL } from "../constants";

export default function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState(null);
  const wsRef = useRef(null);

  const connect = useCallback(() => {
    const wsUrl = API_URL.replace("http", "ws") + "/ws/voice";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      wsRef.current = ws;
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "transcript") {
        setTranscript(msg.text);
      } else if (msg.type === "response") {
        setResponse(msg);
      } else if (msg.type === "audio") {
        playAudio(msg.data);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };
  }, []);

  const sendCommand = useCallback((text) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "command", text }));
    }
  }, []);

  const setContext = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "set_context", data }));
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!wsRef.current) connect();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(",")[1];
            wsRef.current.send(
              JSON.stringify({ type: "audio", data: base64 })
            );
          };
          reader.readAsDataURL(e.data);
        }
      };

      mediaRecorder.start(100);
      setIsListening(true);

      return () => {
        mediaRecorder.stop();
        stream.getTracks().forEach((t) => t.stop());
        setIsListening(false);
      };
    } catch {
      setIsListening(false);
    }
  }, [connect]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  return {
    isListening,
    transcript,
    response,
    connect,
    sendCommand,
    setContext,
    startListening,
    disconnect,
  };
}

function playAudio(base64Data) {
  const raw = atob(base64Data);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

  const audioCtx = new AudioContext();
  audioCtx.decodeAudioData(bytes.buffer).then((buffer) => {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
  });
}
