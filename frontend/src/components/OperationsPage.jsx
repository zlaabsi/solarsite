import { useState, useEffect, useRef, useCallback } from "react";
import { FALLBACK_GHI_KWH_M2_YEAR } from "../constants";

const MONO = "'IBM Plex Mono', 'Space Mono', monospace";
const SERIF = "'DM Serif Display', Georgia, serif";
const BG = "#f0ebe0";
const BLACK = "#1a1a1a";
const ACCENT = "#e05438";

/* ─────────────────────── Corner Brackets ─────────────────────── */
function Corners({ children, className = "", style = {}, breathe = false }) {
  return (
    <div className={`relative ${breathe ? "ops-bracket-breathe" : ""} ${className}`} style={style}>
      <span className="absolute -top-[3px] -left-[3px] w-3 h-3 border-t-[1.5px] border-l-[1.5px] border-[#1a1a1a]" />
      <span className="absolute -top-[3px] -right-[3px] w-3 h-3 border-t-[1.5px] border-r-[1.5px] border-[#1a1a1a]" />
      <span className="absolute -bottom-[3px] -left-[3px] w-3 h-3 border-b-[1.5px] border-l-[1.5px] border-[#1a1a1a]" />
      <span className="absolute -bottom-[3px] -right-[3px] w-3 h-3 border-b-[1.5px] border-r-[1.5px] border-[#1a1a1a]" />
      {children}
    </div>
  );
}

/* ─────────────────────── GHI Counter ─────────────────────── */
function Counter({ target, delay = 1200, suffix = "" }) {
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    const duration = 1600;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setValue(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [started, target]);

  return (
    <span className={started ? "ops-digit" : ""} style={{ opacity: started ? undefined : 0 }}>
      {value.toLocaleString().replace(/,/g, " ")}{suffix}
    </span>
  );
}

/* ─────────────────────── System Log typewriter ─────────────────────── */
const LOG_LINES = [
  "INIT... OK",
  "PVGIS-SARAH3 LINK... STABLE",
  "IRRADIANCE LOCK... CONNECTED",
  "PANEL OPTIMIZER... READY",
  "AI AGENT HANDSHAKE... COMPLETE",
  "YIELD ENGINE... ONLINE",
];

function SystemLog({ baseDelay = 900 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count >= LOG_LINES.length) return;
    const t = setTimeout(() => setCount((c) => c + 1), baseDelay + count * 200);
    return () => clearTimeout(t);
  }, [count, baseDelay]);

  return (
    <div style={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.8, letterSpacing: "0.02em" }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>[ SYSTEM LOG ]</div>
      {LOG_LINES.map((line, i) => (
        <div
          key={i}
          className={i < count ? "ops-log-line" : ""}
          style={{ opacity: i < count ? undefined : 0 }}
        >
          <span style={{ color: BLACK }}>■</span> {line}
        </div>
      ))}
      {count < LOG_LINES.length && (
        <span className="blink" style={{ color: ACCENT, fontSize: 14 }}>_</span>
      )}
    </div>
  );
}

/* ─────────────────────── Irradiance Waveform ─────────────────────── */
function IrradianceWave({ delay = 1800 }) {
  // Bell-curve representing daily GHI pattern (sunrise → peak → sunset)
  const w = 380, h = 60;
  const points = [];
  for (let x = 0; x <= w; x += 2) {
    const t = x / w;
    // Gaussian bell curve: peak at solar noon
    const y = h - Math.exp(-Math.pow((t - 0.5) * 3.2, 2)) * (h - 8);
    points.push(`${x},${y.toFixed(1)}`);
  }
  const linePath = `M${points.join(" L")}`;
  const fillPath = `${linePath} L${w},${h} L0,${h} Z`;

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {/* Horizontal grid lines */}
      {[15, 30, 45].map((y) => (
        <line key={y} x1="0" y1={y} x2={w} y2={y} stroke="rgba(26,26,26,0.06)" strokeWidth="0.5" />
      ))}
      {/* Fill */}
      <path
        d={fillPath}
        fill="url(#waveGrad)"
        className="ops-wave-fill"
        style={{ animationDelay: `${delay + 400}ms` }}
      />
      {/* Stroke */}
      <path
        d={linePath}
        fill="none"
        stroke={ACCENT}
        strokeWidth="1.5"
        className="ops-wave-path"
        style={{ animationDelay: `${delay}ms` }}
      />
      {/* Peak marker */}
      <circle cx={w / 2} cy="8" r="3" fill={ACCENT} opacity="0.8"
        className="ops-scale-in" style={{ animationDelay: `${delay + 600}ms` }}
      />
      <defs>
        <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.12" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0.02" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ─────────────────────── Radar Canvas ─────────────────────── */
function RadarCanvas() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const angleRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width, h = rect.height;
    const cx = w / 2, cy = h / 2;
    ctx.clearRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = "rgba(26,26,26,0.05)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // Concentric circles
    [160, 130, 100, 75, 50].forEach((r, i) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (i === 2) { ctx.strokeStyle = "#1a1a1a"; ctx.setLineDash([]); ctx.lineWidth = 1.2; }
      else { ctx.strokeStyle = i < 2 ? "#aaa" : "#bbb"; ctx.setLineDash([4, 4]); ctx.lineWidth = 0.7; }
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Blue offset orbits (representing solar declination paths)
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(cx - 20, cy - 20, 135, 0, Math.PI * 2);
    ctx.strokeStyle = "#7EC8E3"; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 15, cy + 25, 120, 0, Math.PI * 2);
    ctx.strokeStyle = "#a3cce8"; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.setLineDash([]);

    // Coral orbit (sun annual path)
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(cx - 8, cy + 12, 150, 0, Math.PI * 2);
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.4;
    ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]);

    // Radial lines (azimuth directions)
    ctx.strokeStyle = "rgba(26,26,26,0.08)";
    ctx.lineWidth = 0.5;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 175, cy + Math.sin(a) * 175);
      ctx.stroke();
    }

    // Crosshair
    ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20); ctx.stroke();
    ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();

    // Signal points (panel cluster positions)
    [[-55,-35,2.5],[75,-25,2],[35,55,2],[-35,65,2.5],[-85,15,1.5],[60,-60,1.5]].forEach(([dx,dy,r]) => {
      ctx.fillStyle = "#1a1a1a"; ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(cx+dx, cy+dy, r, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Sweep line (solar azimuth tracker)
    angleRef.current += 0.004;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#7EC8E3"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angleRef.current) * 175, cy + Math.sin(angleRef.current) * 175);
    ctx.stroke();

    // Sweep gradient trail
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 175, angleRef.current - 0.35, angleRef.current);
    ctx.closePath();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 175);
    g.addColorStop(0, "rgba(126,200,227,0.08)");
    g.addColorStop(1, "rgba(126,200,227,0)");
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();

    animRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [draw]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}

/* ═════════════════════════════════════════════════════════════════ */
/*                      OPERATIONS PAGE                             */
/* ═════════════════════════════════════════════════════════════════ */
export default function OperationsPage({ onLaunch, onBack }) {
  const d = (ms) => ({ animationDelay: `${ms}ms` });
  const border = `1px solid ${BLACK}`;

  return (
    <div className="ops-root ops-scan-line" style={{ background: BG, color: BLACK, fontFamily: MONO, minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

      {/* ═══ TOP BANNER ═══ */}
      <div
        className="ops-boot"
        style={{
          ...d(0),
          background: BLACK, color: "#bbb",
          fontSize: 10.5, fontWeight: 500,
          letterSpacing: "0.1em", textTransform: "uppercase",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "9px 40px",
        }}
      >
        <span><span className="ops-status-dot" style={{ color: "#22c55e" }}>●</span> LIVE — FIELD ASSESSMENT READY</span>
        <span style={{ color: "#888" }}>SOLAR AI LABORATORY</span>
        <span style={{ color: "#666" }}>&gt;&gt;&gt; ADAPTIVE IRRADIANCE MONITORING</span>
      </div>

      {/* ═══ NAVBAR ═══ */}
      <nav
        className="ops-boot"
        style={{
          ...d(100),
          display: "flex", alignItems: "center",
          padding: "18px 40px",
          borderBottom: border, gap: 48,
        }}
      >
        <button
          onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <svg width="18" height="16" viewBox="0 0 28 24" fill="none">
            <polygon points="14,0 28,24 0,24" fill={BLACK} />
          </svg>
          <span style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 400, color: BLACK }}>SolarSite</span>
        </button>

        <div style={{ display: "flex", gap: 32, marginLeft: "auto", alignItems: "center" }}>
          {["Process", "Analysis", "Yield", "3D Model"].map((item, i) => (
            <span
              key={item}
              className="ops-nav-link"
              style={{ fontSize: 13.5, color: i === 3 ? ACCENT : BLACK }}
            >
              {item}
            </span>
          ))}
        </div>
      </nav>

      {/* ═══ MAIN LAYOUT ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", flex: 1, minHeight: 0 }}>

        {/* ── LEFT COLUMN ── */}
        <div className="ops-blueprint" style={{ borderRight: border, display: "flex", flexDirection: "column" }}>

          {/* Sub header */}
          <div
            className="ops-spread"
            style={{
              ...d(220),
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 40px",
              borderBottom: border,
              fontSize: 11.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
            }}
          >
            <span>SOLAR ASSESSMENT UNIT</span>
            <span style={{ fontSize: 18, fontWeight: 300, opacity: 0.3 }}>/</span>
            <span>DAKHLA LAB</span>
          </div>

          {/* Hero area */}
          <div style={{ padding: "48px 40px 30px", flex: 1, display: "flex", flexDirection: "column" }}>

            {/* Heading — clip-path reveal */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 28 }}>
              <h1 style={{ fontFamily: SERIF, fontSize: 60, lineHeight: 1.08, fontWeight: 400, letterSpacing: "-0.02em" }}>
                {["Scaling solar", "intelligence", "networks"].map((line, i) => (
                  <span
                    key={i}
                    className="ops-text-reveal"
                    style={{ ...d(350 + i * 150), display: "block" }}
                  >
                    {line}
                  </span>
                ))}
              </h1>
              <span
                className="ops-scale-in"
                style={{ ...d(750), fontFamily: SERIF, fontSize: 48, lineHeight: 1, marginTop: 6, flexShrink: 0, opacity: 0.7 }}
              >
                ®
              </span>
            </div>

            {/* Body */}
            <p
              className="ops-boot-up"
              style={{
                ...d(700),
                fontSize: 13.5, lineHeight: 1.8, color: "#444",
                maxWidth: 480, marginBottom: 36,
              }}
            >
              SolarSite is developing the underlying architecture for
              next-generation solar assessment AI — a distributed network
              capable of analyzing, optimizing, and coordinating across
              all operational layers.
            </p>

            {/* Spec badges */}
            <div
              className="ops-boot-up"
              style={{ ...d(850), display: "flex", gap: 16, marginBottom: 32 }}
            >
              {["PVGIS-SARAH3", "GPT-5 AGENT", "550 Wc MODULES"].map((badge) => (
                <span
                  key={badge}
                  style={{
                    fontSize: 9.5, fontWeight: 600, letterSpacing: "0.1em",
                    textTransform: "uppercase", padding: "5px 12px",
                    border: "1px solid rgba(26,26,26,0.15)",
                    color: "#666",
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>

            {/* CTA */}
            <div className="ops-boot-up" style={{ ...d(950) }}>
              <Corners breathe style={{ display: "inline-flex", width: "fit-content", marginBottom: 40, padding: 4 }}>
                <button
                  onClick={onLaunch}
                  className="ops-cta-btn"
                  style={{
                    background: ACCENT, color: "#fff", border: "none",
                    padding: "16px 44px",
                    fontSize: 12.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase",
                    cursor: "pointer", fontFamily: MONO,
                  }}
                >
                  RUN ANALYSIS
                </button>
              </Corners>
            </div>
          </div>

          {/* Bottom labels */}
          <div
            className="ops-boot-up"
            style={{
              ...d(1050),
              display: "flex", justifyContent: "space-between",
              padding: "16px 40px", borderTop: border,
              fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
            }}
          >
            <span>SOLAR-OPS INFRASTRUCTURE</span>
            <span>BUILT BY ENGINEERS</span>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: "flex", flexDirection: "column" }}>

          {/* System mode bar */}
          <div className="ops-boot" style={d(280)}>
            <Corners
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "16px 24px", borderBottom: border,
                fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
              }}
            >
              System Mode: Active Solar Calibration
            </Corners>
          </div>

          {/* System log + GHI */}
          <div
            className="ops-boot"
            style={{
              ...d(450),
              display: "grid", gridTemplateColumns: "1fr auto",
              padding: "14px 24px", borderBottom: border, gap: 16,
            }}
          >
            <SystemLog baseDelay={900} />

            <Corners style={{ textAlign: "right", padding: "6px 10px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2, opacity: 0.5 }}>
                CURRENT GHI:
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, letterSpacing: "0.01em" }}>
                <Counter target={Math.round(FALLBACK_GHI_KWH_M2_YEAR)} delay={1300} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6 }}>
                kWh/m²
              </div>
            </Corners>
          </div>

          {/* Radar area */}
          <div
            className="ops-boot"
            style={{ ...d(550), flex: 1, position: "relative", minHeight: 340, overflow: "hidden" }}
          >
            <RadarCanvas />
            <div style={{
              position: "absolute", left: 8, top: "50%", transform: "translateY(-50%) rotate(180deg)",
              fontSize: 9.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
              writingMode: "vertical-rl", whiteSpace: "nowrap", opacity: 0.4,
            }}>
              GHI RANGE: 1,800 — 2,400 KWH/M²
            </div>
            <div style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              fontSize: 9.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
              writingMode: "vertical-rl", whiteSpace: "nowrap", opacity: 0.4,
            }}>
              PANEL EFF: 0.800 — 0.950
            </div>
          </div>

          {/* Irradiance waveform */}
          <div
            className="ops-boot-up"
            style={{ ...d(1200), padding: "12px 24px 14px", borderTop: border }}
          >
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.4, marginBottom: 6 }}>
              DAILY IRRADIANCE PROFILE — W/M²
            </div>
            <IrradianceWave delay={1800} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, opacity: 0.3, marginTop: 3, letterSpacing: "0.06em" }}>
              <span>06:00</span>
              <span>SOLAR NOON</span>
              <span>18:00</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ STATS ROW ═══ */}
      <div className="ops-boot-up" style={{ ...d(1000), display: "grid", gridTemplateColumns: "1fr 420px", borderTop: border }}>

        {/* Stats left — solar KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", borderRight: border }}>
          <div style={{ background: BLACK, color: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <span className="ops-scale-in" style={{ ...d(1350), fontFamily: SERIF, fontSize: 72, fontWeight: 400, lineHeight: 1, letterSpacing: -1 }}>
              <Counter target={2150} delay={1400} />
            </span>
            <span className="ops-scale-in" style={{ ...d(1500), fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", opacity: 0.5, marginTop: 4 }}>
              KWH/M²/YR
            </span>
          </div>
          <div style={{ padding: "20px 32px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
              ANNUAL GHI — DAKHLA REGION
            </div>
            <hr className="ops-draw-border" style={{ ...d(1500), width: "100%", border: "none", borderTop: "1.5px dotted #aaa", marginBottom: 12 }} />
            <div style={{ fontSize: 12, lineHeight: 1.7, color: "#666" }}>
              Satellite-derived irradiance via PVGIS-SARAH3.
              AI agent optimizes tilt, spacing, and azimuth
              to maximize energy capture.
            </div>
          </div>
        </div>

        {/* Stats right */}
        <div style={{ padding: "14px 28px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontSize: 10.5, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.7 }}>
              &gt; System Mode: Active Solar Calibration<br />
              &gt; Operational Unit: SL-7145
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.7, textAlign: "right" }}>
              PVGIS v5.3 /<br />SARAH3
            </div>
          </div>
          <hr style={{ width: "100%", border: "none", borderTop: `1px solid ${BLACK}`, margin: "4px 0" }} />
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.5 }}>
            © 2026 SolarSite Division &nbsp;|&nbsp; Experimental Systems Unit
          </div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer
        className="ops-boot-up"
        style={{
          ...d(1150),
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 40px", borderTop: border,
          fontSize: 9.5, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase",
          opacity: 0.6,
        }}
      >
        <span>ALL RESEARCH CONDUCTED UNDER FIELD SPEC:</span>
        <span>2401-SL / SOLAR OPS</span>
        <span>EXPERIMENTAL LABORATORY — DAKHLA, MOROCCO</span>
      </footer>
    </div>
  );
}
