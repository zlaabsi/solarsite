import { useState, useEffect } from "react";
import useAgent from "../hooks/useAgent";
import usePolygonEdit from "../hooks/usePolygonEdit";
import useSolarAnalysis from "../hooks/useSolarAnalysis";
import MapView from "./MapView";
import ModelViewer from "./ModelViewer";
import ReportPanel from "./ReportPanel";
import {
  DEFAULT_LAT,
  DEFAULT_LON,
  DEFAULT_PANEL_TILT_DEG,
  DEFAULT_PANEL_AZIMUTH_DEG,
  DEFAULT_ROW_SPACING_M,
  DEFAULT_MODULE_WIDTH_M,
  DEFAULT_MODULE_HEIGHT_M,
  DEFAULT_MODULE_POWER_WC,
  DEFAULT_SYSTEM_LOSS_PCT,
  DEFAULT_ALBEDO,
  FALLBACK_GHI_KWH_M2_YEAR,
  FALLBACK_SUNSHINE_HOURS,
} from "../constants";

/* ─────────────────────── Coord Formatter ─────────────────────── */
function formatCoord(lat, lon) {
  const latD = lat >= 0 ? "N" : "S";
  const lonD = lon >= 0 ? "E" : "W";
  return {
    lat: `${Math.abs(lat).toFixed(4)}\u00b0${latD}`,
    lon: `${Math.abs(lon).toFixed(4)}\u00b0${lonD}`,
    label: `${Math.abs(lat).toFixed(2)}\u00b0${latD} ${Math.abs(lon).toFixed(2)}\u00b0${lonD}`,
  };
}

/* ─────────────────────── Corner Brackets ─────────────────────── */
function Corners({ children, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute -top-px -left-px w-3 h-3 border-t border-l border-ink" />
      <span className="absolute -top-px -right-px w-3 h-3 border-t border-r border-ink" />
      <span className="absolute -bottom-px -left-px w-3 h-3 border-b border-l border-ink" />
      <span className="absolute -bottom-px -right-px w-3 h-3 border-b border-r border-ink" />
      {children}
    </div>
  );
}

/* ─────────────────────── Metric Cell ─────────────────────── */
function Metric({ label, value, unit, accent }) {
  return (
    <div
      className="px-3 py-2.5"
      style={{
        borderBottom: "1px solid rgba(26,26,26,0.08)",
      }}
    >
      <div
        style={{
          fontSize: "9.5px",
          letterSpacing: "0.13em",
          textTransform: "uppercase",
          opacity: 0.45,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          style={{
            fontSize: accent ? "22px" : "18px",
            fontWeight: 700,
            fontFamily: "'IBM Plex Mono', monospace",
            color: accent ? "#e05438" : "#1a1a1a",
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: "10px", opacity: 0.4 }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── Mini Radar (decorative) ─────────────────────── */
function MiniRadar({ isActive }) {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" style={{ opacity: 0.6 }}>
      <circle cx="60" cy="60" r="55" fill="none" stroke="#1A1A1A" strokeWidth="0.5" strokeDasharray="4 3" />
      <circle cx="60" cy="60" r="38" fill="none" stroke="#1A1A1A" strokeWidth="0.5" strokeDasharray="4 3" />
      <circle cx="60" cy="60" r="20" fill="none" stroke="#1A1A1A" strokeWidth="0.5" strokeDasharray="4 3" />
      <circle cx="63" cy="65" r="28" fill="none" stroke="#7EC8E3" strokeWidth="0.7" strokeDasharray="3 3" />
      <circle cx="58" cy="57" r="45" fill="none" stroke="#E8613A" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.4" />
      {isActive && (
        <line x1="60" y1="60" x2="60" y2="5" stroke="#E8613A" strokeWidth="0.6" opacity="0.5" className="radar-sweep" />
      )}
      <line x1="55" y1="65" x2="65" y2="65" stroke="#1A1A1A" strokeWidth="0.6" />
      <line x1="60" y1="55" x2="60" y2="70" stroke="#1A1A1A" strokeWidth="0.6" />
    </svg>
  );
}

/* ─────────────────────── Time Control (Atlas-styled) ─────────────────────── */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function TimeControl({ hour, month, onHourChange, onMonthChange }) {
  return (
    <div className="px-3 py-3" style={{ borderBottom: "1px solid rgba(26,26,26,0.08)" }}>
      <div
        style={{
          fontSize: "9.5px",
          letterSpacing: "0.13em",
          textTransform: "uppercase",
          opacity: 0.45,
          marginBottom: 6,
        }}
      >
        SHADOW SIM
      </div>
      <div style={{ fontSize: "13px", fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>
        {MONTHS[month - 1]} — {String(hour).padStart(2, "0")}:00
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <input
            type="range" min={5} max={20} value={hour}
            onChange={(e) => onHourChange(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: "#e05438", height: 2 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <input
            type="range" min={1} max={12} value={month}
            onChange={(e) => onMonthChange(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: "#e05438", height: 2 }}
          />
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ */
/*                          MAIN VIEW                              */
/* ═════════════════════════════════════════════════════════════════ */
export default function AppView({ onBack }) {
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

  const [mode, setMode] = useState("test");
  const [hour, setHour] = useState(12);
  const [month, setMonth] = useState(6);
  const [showModel, setShowModel] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapSeason, setHeatmapSeason] = useState("summer");
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [is3D, setIs3D] = useState(true);

  /* ─── User-drawn polygon ─── */
  const [drawnPolygon, setDrawnPolygon] = useState(null);

  /* ─── Polygon edit state ─── */
  const [polygonOverride, setPolygonOverride] = useState(null);
  const [analysisOverride, setAnalysisOverride] = useState(null);
  const [reAnalyzing, setReAnalyzing] = useState(false);

  const effectivePolygon = polygonOverride || drawnPolygon || polygon;
  const effectiveAnalysis = analysisOverride || analysisData;

  const {
    editPolygon,
    editCorners,
    isEditing,
    editMode: currentEditMode,
    isDragging: isDragEditing,
    startEdit,
    cancelEdit,
    commitEdit,
    setEditMode: setPolygonEditMode,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = usePolygonEdit(effectivePolygon);

  const { analyze } = useSolarAnalysis();

  // Reset overrides when agent runs again
  useEffect(() => {
    if (agentState === "running") {
      setDrawnPolygon(null);
      setPolygonOverride(null);
      setAnalysisOverride(null);
      setReAnalyzing(false);
    }
  }, [agentState]);

  const handleApplyEdit = async () => {
    const result = commitEdit();
    if (!result) return;
    const { polygon: newPolygon, azimuthDeg } = result;
    setPolygonOverride(newPolygon);
    setReAnalyzing(true);
    try {
      const analysis = await analyze({
        latitude: DEFAULT_LAT,
        longitude: DEFAULT_LON,
        polygon_geojson: newPolygon,
        panel_tilt_deg: DEFAULT_PANEL_TILT_DEG,
        panel_azimuth_deg: azimuthDeg,
        row_spacing_m: DEFAULT_ROW_SPACING_M,
        module_width_m: DEFAULT_MODULE_WIDTH_M,
        module_height_m: DEFAULT_MODULE_HEIGHT_M,
        module_power_wc: DEFAULT_MODULE_POWER_WC,
        system_loss_pct: DEFAULT_SYSTEM_LOSS_PCT,
        albedo: DEFAULT_ALBEDO,
      });
      if (analysis) setAnalysisOverride(analysis);
    } finally {
      setReAnalyzing(false);
    }
  };

  const hasDrawnPolygon = !!drawnPolygon;

  const handleLaunch = async () => {
    if (hasDrawnPolygon) {
      // Direct analysis with user-drawn polygon (skip agent)
      setReAnalyzing(true);
      try {
        const analysis = await analyze({
          latitude: DEFAULT_LAT,
          longitude: DEFAULT_LON,
          polygon_geojson: drawnPolygon,
          panel_tilt_deg: DEFAULT_PANEL_TILT_DEG,
          panel_azimuth_deg: DEFAULT_PANEL_AZIMUTH_DEG,
          row_spacing_m: DEFAULT_ROW_SPACING_M,
          module_width_m: DEFAULT_MODULE_WIDTH_M,
          module_height_m: DEFAULT_MODULE_HEIGHT_M,
          module_power_wc: DEFAULT_MODULE_POWER_WC,
          system_loss_pct: DEFAULT_SYSTEM_LOSS_PCT,
          albedo: DEFAULT_ALBEDO,
        });
        if (analysis) setAnalysisOverride(analysis);
      } finally {
        setReAnalyzing(false);
      }
    } else {
      // No drawn polygon → run full agent (creates its own zone)
      runAgent(DEFAULT_LAT, DEFAULT_LON, 5.0, mode);
    }
  };

  const handleFinishDrawing = () => {
    if (drawingPoints.length < 3) return;
    // Convert drawn points to GeoJSON Polygon
    const closed = [...drawingPoints, drawingPoints[0]];
    setDrawnPolygon({ type: "Polygon", coordinates: [closed] });
    setIsDrawing(false);
    setDrawingPoints([]);
    // Clear any previous analysis since polygon changed
    setAnalysisOverride(null);
    setPolygonOverride(null);
  };

  const handleCancelDrawing = () => {
    setIsDrawing(false);
    setDrawingPoints([]);
  };

  const handleMapClick = (lngLat) => {
    if (isDrawing) {
      setDrawingPoints((prev) => [...prev, [lngLat.lng, lngLat.lat]]);
    }
  };

  const isRunning = agentState === "running";
  const isDone = agentState === "done";
  const hasAnalysis = !!effectiveAnalysis;
  const displayLat = effectiveAnalysis?.site_info?.latitude ?? DEFAULT_LAT;
  const displayLon = effectiveAnalysis?.site_info?.longitude ?? DEFAULT_LON;
  const coords = formatCoord(displayLat, displayLon);
  const locationName = effectiveAnalysis?.site_info?.location_name || "";

  const ghi = effectiveAnalysis?.solar_data?.annual_ghi_kwh_m2 ?? FALLBACK_GHI_KWH_M2_YEAR;
  const lcoe = effectiveAnalysis?.yield_info?.lcoe_eur_mwh;
  const panels = effectiveAnalysis?.layout?.n_panels;
  const capacity = effectiveAnalysis?.yield_info?.installed_capacity_mwc;
  const annualYield = effectiveAnalysis?.yield_info?.annual_yield_kwh;
  const pr = effectiveAnalysis?.yield_info?.performance_ratio;
  const shadowLoss = effectiveAnalysis?.shadow_analysis?.annual_shadow_loss_pct;
  const co2 = effectiveAnalysis?.yield_info?.co2_avoided_tons_yr;

  /* System log */
  const toolLabels = {
    select_zone: "ZONE SELECT",
    run_solar_analysis: "SOLAR ANALYSIS",
    generate_3d_visualization: "3D RENDER",
  };

  const defaultLog = [
    "INIT... OK",
    "PVGIS LINK... STABLE",
    "PANEL OPTIMIZER... READY",
    "AI AGENT... STANDBY",
  ];

  const agentLog = steps.length > 0
    ? steps.map(
        (s) =>
          `${toolLabels[s.tool] || s.tool.toUpperCase()}... ${s.status === "done" ? "DONE" : "RUNNING"}`
      )
    : [];

  const logLines = agentLog.length > 0 ? agentLog : defaultLog;

  return (
    <div className="app-root h-screen flex flex-col overflow-hidden" style={{ fontFamily: "'IBM Plex Mono', 'Space Mono', monospace" }}>

      {/* ═══════════ TICKER BAR ═══════════ */}
      <div
        className="shrink-0 select-none"
        style={{
          background: "#1a1a1a",
          color: "#f0ebe0",
          padding: "7px 24px",
          fontSize: "10px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>
          {reAnalyzing ? (
            <><span style={{ color: "#e05438" }}>●</span> RE-ANALYZING — UPDATED ZONE</>
          ) : isEditing ? (
            <><span style={{ color: "#e05438" }}>●</span> EDITING — ZONE GEOMETRY</>
          ) : isRunning ? (
            <><span style={{ color: "#e05438" }}>●</span> ACTIVE — ANALYSIS IN PROGRESS</>
          ) : isDone ? (
            <><span style={{ color: "#22c55e" }}>●</span> COMPLETE — RESULTS READY</>
          ) : (
            <><span style={{ color: "#22c55e" }}>●</span> LIVE — FIELD ASSESSMENT READY</>
          )}
        </span>
        <span>SOLAR AI LABORATORY</span>
        <span>{locationName ? `${locationName} — ${coords.label}` : coords.label}</span>
      </div>

      {/* ═══════════ NAV BAR ═══════════ */}
      <nav
        className="shrink-0"
        style={{
          background: "#f0ebe0",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(26,26,26,0.12)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <polygon points="7,1 13,13 1,13" fill="#1A1A1A" />
          </svg>
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, fontWeight: 400 }}>
            SolarSite
          </span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {/* Mode toggle */}
          <div style={{ display: "flex", border: "1px solid rgba(26,26,26,0.15)", overflow: "hidden" }}>
            {["test", "demo"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: "5px 14px",
                  fontSize: "10px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  background: mode === m ? "#1a1a1a" : "transparent",
                  color: mode === m ? "#f0ebe0" : "#1a1a1a",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {m === "test" ? "TEST" : "DEMO"}
              </button>
            ))}
          </div>
          <span style={{ opacity: 0.2 }}>|</span>
          <span style={{ opacity: 0.4 }}>UNIT: SL-7145</span>
        </div>
      </nav>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <div className="flex-1 flex min-h-0">

        {/* ───────── LEFT SIDEBAR (320px) ───────── */}
        <div
          className="shrink-0 flex flex-col overflow-y-auto"
          style={{
            width: 320,
            background: "#f0ebe0",
            borderRight: "1px solid rgba(26,26,26,0.12)",
          }}
        >
          {/* Agent Controls */}
          <div className="px-3 py-3" style={{ borderBottom: "1px solid rgba(26,26,26,0.08)" }}>
            <div
              style={{
                fontSize: "9.5px",
                letterSpacing: "0.13em",
                textTransform: "uppercase",
                opacity: 0.45,
                marginBottom: 8,
              }}
            >
              AGENT CONTROL
            </div>
            <Corners className="p-1">
              <button
                onClick={isRunning ? stopAgent : handleLaunch}
                disabled={reAnalyzing}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  background: isRunning ? "#1a1a1a" : reAnalyzing ? "#888" : "#e05438",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontFamily: "inherit",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  transition: "background 0.15s",
                }}
              >
                {isRunning ? "■  STOP AGENT" : reAnalyzing ? "●  ANALYZING..." : hasDrawnPolygon ? "▶  ANALYZE ZONE" : isDone ? "↻  RUN AGAIN" : "▶  RUN ANALYSIS"}
              </button>
            </Corners>

            {/* Step progress */}
            {steps.length > 0 && (
              <div style={{ marginTop: 10, fontSize: "10.5px" }}>
                {steps.map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
                    {step.status === "done" ? (
                      <span style={{ color: "#22c55e", fontSize: 11 }}>✓</span>
                    ) : (
                      <span style={{ color: "#e05438" }} className="blink">●</span>
                    )}
                    <span style={{ opacity: step.status === "done" ? 0.5 : 1 }}>
                      {toolLabels[step.tool] || step.tool}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div style={{ marginTop: 8, fontSize: "10px", color: "#dc2626", padding: "6px 8px", background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)" }}>
                {error}
              </div>
            )}
          </div>

          {/* System Log */}
          <div className="px-3 py-3" style={{ borderBottom: "1px solid rgba(26,26,26,0.08)" }}>
            <Corners className="px-3 py-2.5">
              <div style={{ fontSize: "9.5px", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45, marginBottom: 6 }}>
                [ SYSTEM LOG ]
              </div>
              <div style={{ fontSize: "10.5px", lineHeight: 1.8, fontFamily: "inherit" }}>
                {logLines.map((line, i) => (
                  <div key={i} style={{ opacity: agentLog.length > 0 && i === agentLog.length - 1 && isRunning ? 1 : 0.7 }}>
                    ■ {line}
                  </div>
                ))}
              </div>
              {isRunning && thinking && (
                <div style={{ marginTop: 4, fontSize: "9.5px", opacity: 0.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {thinking.slice(-80)}<span className="blink">_</span>
                </div>
              )}
            </Corners>
          </div>

          {/* GHI Readout */}
          <div className="px-3 py-3" style={{ borderBottom: "1px solid rgba(26,26,26,0.08)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: "9.5px", letterSpacing: "0.13em", textTransform: "uppercase", opacity: 0.45 }}>
                GHI:
              </span>
              <span style={{ fontSize: "28px", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
                {Math.round(ghi).toLocaleString()}
              </span>
              <span style={{ fontSize: "11px", fontWeight: 600, opacity: 0.5 }}>kWh/m²</span>
            </div>
          </div>

          {/* Time control */}
          <TimeControl
            hour={hour}
            month={month}
            onHourChange={setHour}
            onMonthChange={setMonth}
          />

          {/* KPI Metrics (shown after analysis) */}
          {hasAnalysis && (
            <>
              <Metric label="Installed Capacity" value={capacity?.toFixed(2)} unit="MWc" accent />
              <Metric label="Annual Yield" value={annualYield?.toLocaleString()} unit="kWh/yr" />
              <Metric label="LCOE" value={lcoe?.toFixed(1)} unit="€/MWh" accent />
              <Metric label="Performance Ratio" value={`${(pr * 100).toFixed(1)}`} unit="%" />
              <Metric label="Shadow Loss" value={shadowLoss?.toFixed(1)} unit="%" />
              <Metric label="CO₂ Avoided" value={co2?.toFixed(0)} unit="t/yr" />
              <Metric label="Panels" value={panels?.toLocaleString()} unit="" />
            </>
          )}

          {/* View toggles (shown after analysis) */}
          {hasAnalysis && (
            <div className="px-3 py-3" style={{ borderBottom: "1px solid rgba(26,26,26,0.08)" }}>
              <div
                style={{
                  fontSize: "9.5px",
                  letterSpacing: "0.13em",
                  textTransform: "uppercase",
                  opacity: 0.45,
                  marginBottom: 8,
                }}
              >
                OVERLAYS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Heatmap toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    style={{
                      flex: 1,
                      padding: "7px 12px",
                      background: showHeatmap ? "#e05438" : "transparent",
                      color: showHeatmap ? "#fff" : "#1a1a1a",
                      border: showHeatmap ? "none" : "1px solid rgba(26,26,26,0.15)",
                      cursor: "pointer",
                      fontSize: "10px",
                      fontFamily: "inherit",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      transition: "all 0.15s",
                    }}
                  >
                    {showHeatmap ? "● HEATMAP ON" : "HEATMAP"}
                  </button>
                  {showHeatmap && (
                    <div style={{ display: "flex", border: "1px solid rgba(26,26,26,0.15)", overflow: "hidden" }}>
                      {["summer", "winter"].map((s) => (
                        <button
                          key={s}
                          onClick={() => setHeatmapSeason(s)}
                          style={{
                            padding: "6px 10px",
                            fontSize: "9px",
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            background: heatmapSeason === s ? "#1a1a1a" : "transparent",
                            color: heatmapSeason === s ? "#f0ebe0" : "#1a1a1a",
                            border: "none",
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          {s.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Report toggle */}
                <button
                  onClick={() => setShowReport(!showReport)}
                  style={{
                    width: "100%",
                    padding: "7px 12px",
                    background: showReport ? "#1a1a1a" : "transparent",
                    color: showReport ? "#f0ebe0" : "#1a1a1a",
                    border: showReport ? "none" : "1px solid rgba(26,26,26,0.15)",
                    cursor: "pointer",
                    fontSize: "10px",
                    fontFamily: "inherit",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    transition: "all 0.15s",
                  }}
                >
                  {showReport ? "● REPORT" : "SITE REPORT"}
                </button>
              </div>
            </div>
          )}

          {/* 3D Model toggle */}
          {model3D?.model_glb_url && (
            <div className="px-3 py-3" style={{ borderBottom: "1px solid rgba(26,26,26,0.08)" }}>
              <Corners className="p-1">
                <button
                  onClick={() => setShowModel(!showModel)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: showModel ? "#1a1a1a" : "transparent",
                    color: showModel ? "#f0ebe0" : "#1a1a1a",
                    border: showModel ? "none" : "1px solid rgba(26,26,26,0.15)",
                    cursor: "pointer",
                    fontSize: "10.5px",
                    fontFamily: "inherit",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    transition: "all 0.15s",
                  }}
                >
                  {showModel ? "← BACK TO MAP" : "VIEW 3D MODEL"}
                </button>
              </Corners>
            </div>
          )}

          {/* Site Report Panel (expandable) */}
          {showReport && hasAnalysis && (
            <div
              style={{
                borderBottom: "1px solid rgba(26,26,26,0.08)",
                background: "#1a1a1a",
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              <ReportPanel data={analysisData} />
            </div>
          )}

          {/* Mini radar (decorative, bottom of sidebar) */}
          <div className="flex-1 flex items-end justify-center px-6 py-4" style={{ minHeight: 120 }}>
            <div style={{ width: 100, height: 100 }}>
              <MiniRadar isActive={isRunning} />
            </div>
          </div>
        </div>

        {/* ───────── MAIN: MAP / 3D MODEL ───────── */}
        <div className="flex-1 relative min-h-0">

          {showModel && model3D?.model_glb_url ? (
            /* 3D Model viewer — uses ModelViewer component which imports @google/model-viewer */
            <div className="w-full h-full" style={{ background: "#111" }}>
              <ModelViewer glbUrl={model3D.model_glb_url} />
            </div>
          ) : (
            /* Satellite map */
            <MapView
              analysisData={effectiveAnalysis}
              isDrawing={isDrawing}
              drawingPoints={drawingPoints}
              polygon={effectivePolygon}
              onMapClick={handleMapClick}
              hour={hour}
              month={month}
              is3D={is3D}
              onToggle3D={() => setIs3D(!is3D)}
              showHeatmap={showHeatmap}
              heatmapSeason={heatmapSeason}
              isEditing={isEditing}
              editPolygon={editPolygon}
              editCorners={editCorners}
              editMode={currentEditMode}
              isDragEditing={isDragEditing}
              onEditPointerDown={handlePointerDown}
              onEditPointerMove={handlePointerMove}
              onEditPointerUp={handlePointerUp}
            />
          )}

          {/* ── Map overlay: STOP button when running ── */}
          {isRunning && (
            <button
              onClick={stopAgent}
              style={{
                position: "absolute",
                top: 16,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 20,
                padding: "10px 28px",
                background: "rgba(220,38,38,0.9)",
                backdropFilter: "blur(8px)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.15)",
                cursor: "pointer",
                fontSize: "11px",
                fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 24px rgba(220,38,38,0.4)",
              }}
            >
              <span style={{ fontSize: 14 }}>■</span> STOP ANALYSIS
            </button>
          )}

          {/* ── Map overlay: drawing controls + edit zone (top-right) ── */}
          <div style={{ position: "absolute", top: 16, right: 16, zIndex: 10, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            {/* Drawing controls */}
            <div style={{ display: "flex", gap: 8 }}>
              {!isDrawing && !isEditing ? (
                <button
                  onClick={() => { setIsDrawing(true); setDrawingPoints([]); }}
                  style={{
                    padding: "8px 16px",
                    background: "rgba(26,26,26,0.85)",
                    backdropFilter: "blur(8px)",
                    color: "#f0ebe0",
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    fontSize: "10.5px",
                    fontFamily: "'IBM Plex Mono', monospace",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  ✎ DRAW ZONE
                </button>
              ) : isDrawing ? (
                <>
                  <button
                    onClick={handleFinishDrawing}
                    disabled={drawingPoints.length < 3}
                    style={{
                      padding: "8px 16px",
                      background: drawingPoints.length >= 3 ? "rgba(34,197,94,0.85)" : "rgba(26,26,26,0.5)",
                      backdropFilter: "blur(8px)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.1)",
                      cursor: drawingPoints.length >= 3 ? "pointer" : "not-allowed",
                      fontSize: "10.5px",
                      fontFamily: "'IBM Plex Mono', monospace",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    ✓ FINISH ({drawingPoints.length} pts)
                  </button>
                  <button
                    onClick={handleCancelDrawing}
                    style={{
                      padding: "8px 16px",
                      background: "rgba(220,38,38,0.8)",
                      backdropFilter: "blur(8px)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.1)",
                      cursor: "pointer",
                      fontSize: "10.5px",
                      fontFamily: "'IBM Plex Mono', monospace",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    ✕ CANCEL
                  </button>
                </>
              ) : null}
            </div>

            {/* CLEAR ZONE button — shown when user has a drawn polygon */}
            {hasDrawnPolygon && !isEditing && !isRunning && !isDrawing && !reAnalyzing && (
              <button
                onClick={() => { setDrawnPolygon(null); setAnalysisOverride(null); setPolygonOverride(null); }}
                style={{
                  padding: "8px 16px",
                  background: "rgba(220,38,38,0.8)",
                  backdropFilter: "blur(8px)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.1)",
                  cursor: "pointer",
                  fontSize: "10.5px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                ✕ CLEAR ZONE
              </button>
            )}

            {/* EDIT ZONE button — shown when analysis done + not editing + not running */}
            {hasAnalysis && !isEditing && !isRunning && !isDrawing && !reAnalyzing && (
              <button
                onClick={startEdit}
                style={{
                  padding: "8px 16px",
                  background: "rgba(26,26,26,0.85)",
                  backdropFilter: "blur(8px)",
                  color: "#f0ebe0",
                  border: "1px solid rgba(255,255,255,0.1)",
                  cursor: "pointer",
                  fontSize: "10.5px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                ✎ EDIT ZONE
              </button>
            )}

            {/* Edit mode controls — shown when editing */}
            {isEditing && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                {/* Mode toggles */}
                <div
                  style={{
                    background: "rgba(26,26,26,0.85)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    overflow: "hidden",
                  }}
                >
                  {["translate", "resize", "rotate"].map((m) => {
                    const active = currentEditMode === m;
                    const label = m === "translate" ? "MOVE" : m === "resize" ? "RESIZE" : "ROTATE";
                    return (
                      <button
                        key={m}
                        onClick={() => setPolygonEditMode(m)}
                        style={{
                          padding: "6px 14px",
                          background: active ? "rgba(224,84,56,0.9)" : "transparent",
                          color: active ? "#fff" : "rgba(240,235,224,0.5)",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "10px",
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontWeight: active ? 700 : 400,
                          letterSpacing: "0.1em",
                          transition: "all 0.15s",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* APPLY / CANCEL */}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={handleApplyEdit}
                    style={{
                      padding: "8px 18px",
                      background: "rgba(34,197,94,0.85)",
                      backdropFilter: "blur(8px)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.15)",
                      cursor: "pointer",
                      fontSize: "10.5px",
                      fontFamily: "'IBM Plex Mono', monospace",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    ✓ APPLY
                  </button>
                  <button
                    onClick={cancelEdit}
                    style={{
                      padding: "8px 18px",
                      background: "rgba(220,38,38,0.8)",
                      backdropFilter: "blur(8px)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.15)",
                      cursor: "pointer",
                      fontSize: "10.5px",
                      fontFamily: "'IBM Plex Mono', monospace",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    ✕ CANCEL
                  </button>
                </div>
              </div>
            )}

            {/* Re-analyzing spinner overlay */}
            {reAnalyzing && (
              <div
                style={{
                  padding: "8px 16px",
                  background: "rgba(26,26,26,0.85)",
                  backdropFilter: "blur(8px)",
                  color: "#e05438",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "10.5px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                <span className="blink">●</span> RE-ANALYZING...
              </div>
            )}
          </div>

          {/* ── Map overlay: coordinates + status (bottom-left) ── */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              zIndex: 10,
              background: "rgba(26,26,26,0.85)",
              backdropFilter: "blur(8px)",
              padding: "8px 14px",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: "10px",
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(240,235,224,0.7)",
            }}
          >
            <span>{coords.lat}</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>{coords.lon}</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>{MONTHS[month - 1]} {String(hour).padStart(2, "0")}:00</span>
            {hasAnalysis && (
              <>
                <span style={{ opacity: 0.3 }}>|</span>
                <span style={{ color: "#22c55e" }}>● {panels} PANELS</span>
              </>
            )}
          </div>

          {/* ── Map overlay: GHI badge + 2D/3D toggle (top-left) ── */}
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              zIndex: 10,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <div
              style={{
                background: "rgba(26,26,26,0.85)",
                backdropFilter: "blur(8px)",
                padding: "6px 12px",
                border: "1px solid rgba(255,255,255,0.08)",
                fontSize: "10px",
                fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(240,235,224,0.7)",
              }}
            >
              GHI: <span style={{ color: "#e05438", fontWeight: 700 }}>{Math.round(ghi)}</span> kWh/m²
            </div>

            {/* 2D / 3D toggle */}
            <div
              style={{
                background: "rgba(26,26,26,0.85)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                overflow: "hidden",
              }}
            >
              {["2D", "3D"].map((label) => {
                const active = label === "3D" ? is3D : !is3D;
                return (
                  <button
                    key={label}
                    onClick={() => setIs3D(label === "3D")}
                    style={{
                      padding: "6px 14px",
                      background: active ? "rgba(224,84,56,0.9)" : "transparent",
                      color: active ? "#fff" : "rgba(240,235,224,0.5)",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "10px",
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: active ? 700 : 400,
                      letterSpacing: "0.1em",
                      transition: "all 0.15s",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ BOTTOM BAR ═══════════ */}
      <div
        className="shrink-0 select-none"
        style={{
          background: "#f0ebe0",
          padding: "8px 24px",
          fontSize: "9.5px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid rgba(26,26,26,0.12)",
          opacity: 0.5,
        }}
      >
        <span>SPEC: 2401-SL / SOLAR OPS</span>
        <span>{FALLBACK_SUNSHINE_HOURS}+ SUNSHINE HOURS / YEAR</span>
        <span>{locationName ? `SOLAR AI LABORATORY — ${locationName}` : "SOLAR AI LABORATORY"}</span>
      </div>
    </div>
  );
}
