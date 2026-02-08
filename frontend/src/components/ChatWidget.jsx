import { useState, useRef, useEffect, useCallback } from "react";
import useChat from "../hooks/useChat";

export default function ChatWidget({ analysisData, onAction }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const handleAction = useCallback(
    (actionData) => {
      if (actionData?.action && onAction) {
        onAction(actionData.action);
      }
    },
    [onAction]
  );

  const { messages, isStreaming, isListening, sendMessage, startListening, stopListening, clearMessages } =
    useChat({ onAction: handleAction });

  /* Auto-scroll on new messages */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  /* Focus input when opened */
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input, analysisData);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening((transcript) => {
        setInput(transcript);
      });
    }
  };

  const font = "'IBM Plex Mono', 'Space Mono', monospace";

  /* ── Closed state: floating button ── */
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          zIndex: 30,
          padding: "10px 20px",
          background: "#1a1a1a",
          color: "#f0ebe0",
          border: "1px solid rgba(240,235,224,0.12)",
          cursor: "pointer",
          fontSize: "10.5px",
          fontFamily: font,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "all 0.15s",
        }}
      >
        <span style={{ color: "#e05438", fontSize: 14 }}>&#9670;</span>
        AI CHAT
      </button>
    );
  }

  /* ── Open state: chat panel ── */
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        zIndex: 30,
        width: 360,
        height: 480,
        background: "#f0ebe0",
        border: "1px solid rgba(26,26,26,0.15)",
        display: "flex",
        flexDirection: "column",
        fontFamily: font,
        boxShadow: "0 8px 32px rgba(26,26,26,0.25)",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          background: "#1a1a1a",
          color: "#f0ebe0",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#e05438", fontSize: 12 }}>&#9670;</span>
          <span
            style={{
              fontSize: "10.5px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            SOLAR AI CHAT
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={clearMessages}
            title="Clear chat"
            style={{
              background: "none",
              border: "none",
              color: "rgba(240,235,224,0.4)",
              cursor: "pointer",
              fontSize: "10px",
              fontFamily: font,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "2px 6px",
            }}
          >
            CLR
          </button>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(240,235,224,0.5)",
              cursor: "pointer",
              fontSize: "14px",
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "9.5px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                opacity: 0.3,
                lineHeight: 1.8,
                maxWidth: 220,
              }}
            >
              ASK ABOUT YOUR ANALYSIS OR GIVE COMMANDS
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "85%",
              }}
            >
              <div
                style={{
                  background: isUser ? "#1a1a1a" : "rgba(26,26,26,0.06)",
                  color: isUser ? "#f0ebe0" : "#1a1a1a",
                  padding: "8px 12px",
                  fontSize: "11.5px",
                  lineHeight: 1.6,
                  border: isUser
                    ? "none"
                    : "1px solid rgba(26,26,26,0.08)",
                  wordBreak: "break-word",
                }}
              >
                {msg.content}
                {!isUser && isStreaming && msg === messages[messages.length - 1] && (
                  <span
                    style={{ opacity: 0.5 }}
                    className="blink"
                  >
                    _
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Input ── */}
      <div
        style={{
          borderTop: "1px solid rgba(26,26,26,0.1)",
          padding: "8px 10px",
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexShrink: 0,
          background: "#f0ebe0",
        }}
      >
        {/* Mic button */}
        <button
          onClick={handleMicToggle}
          title={isListening ? "Stop recording" : "Start recording"}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: isListening ? "#e05438" : "rgba(26,26,26,0.06)",
            color: isListening ? "#fff" : "#1a1a1a",
            border: isListening
              ? "none"
              : "1px solid rgba(26,26,26,0.12)",
            cursor: "pointer",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
        >
          {isListening ? "\u25A0" : "\u25CF"}
        </button>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? "Listening..." : "Ask a question..."}
          disabled={isStreaming}
          style={{
            flex: 1,
            padding: "7px 10px",
            background: "rgba(26,26,26,0.04)",
            border: "1px solid rgba(26,26,26,0.1)",
            color: "#1a1a1a",
            fontSize: "11px",
            fontFamily: font,
            letterSpacing: "0.04em",
            outline: "none",
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          style={{
            padding: "7px 14px",
            background:
              isStreaming || !input.trim() ? "rgba(26,26,26,0.15)" : "#1a1a1a",
            color: "#f0ebe0",
            border: "none",
            cursor:
              isStreaming || !input.trim() ? "not-allowed" : "pointer",
            fontSize: "9.5px",
            fontFamily: font,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 600,
            flexShrink: 0,
            transition: "all 0.15s",
          }}
        >
          SEND
        </button>
      </div>
    </div>
  );
}
