import { useState, useEffect, useRef } from "react";
import useVoice from "../hooks/useVoice";

export default function VoiceControl({ analysisData }) {
  const {
    isListening,
    transcript,
    response,
    connect,
    sendCommand,
    setContext,
    startListening,
    disconnect,
  } = useVoice();

  const [textInput, setTextInput] = useState("");
  const [connected, setConnected] = useState(false);
  const stopRef = useRef(null);

  useEffect(() => {
    if (connected && analysisData) {
      setContext(analysisData);
    }
  }, [analysisData, connected, setContext]);

  const handleConnect = () => {
    connect();
    setConnected(true);
  };

  const handleMicToggle = async () => {
    if (isListening && stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    } else {
      const stop = await startListening();
      stopRef.current = stop;
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (textInput.trim()) {
      sendCommand(textInput.trim());
      setTextInput("");
    }
  };

  return (
    <div className="p-4 border-t border-gray-800">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Voice Assistant
      </h3>

      {!connected ? (
        <button
          onClick={handleConnect}
          className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg text-sm transition"
        >
          Connect Voice
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={handleMicToggle}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300"
              }`}
            >
              {isListening ? "Stop" : "Mic"}
            </button>

            <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-black px-3 py-2 rounded-lg text-sm font-medium transition"
              >
                Send
              </button>
            </form>
          </div>

          {transcript && (
            <div className="text-xs text-gray-500">
              You: {transcript}
            </div>
          )}
          {response?.spoken_response && (
            <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-300">
              {response.spoken_response}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
