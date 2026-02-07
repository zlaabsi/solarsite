import { useState, useEffect, useRef, useCallback } from "react";

const SERIF = "'DM Serif Display', Georgia, serif";
const SANS = "'DM Sans', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'Courier New', monospace";

/* ─── IntersectionObserver hook ─── */
function useInView(options = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.15, ...options }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

/* ─── Decorative star/diamond ─── */
function Star({ x, y, size = 16, color = "#c8b890", delay = 0, duration = 4, parallaxSpeed = 0 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      data-parallax={parallaxSpeed}
      style={{
        position: "absolute",
        left: x,
        top: y,
        animation: `twinkle ${duration}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
        pointerEvents: "none",
        willChange: "transform",
        transition: "transform 0.1s linear",
      }}
    >
      <path
        d="M8 0l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"
        fill={color}
      />
    </svg>
  );
}

/* ─── Small diamond marker ─── */
function Diamond({ color = "#c8b890", size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M8 1l2.5 5.5L16 8l-5.5 2.5L8 16l-2.5-5.5L0 8l5.5-2.5L8 1z" fill={color} />
    </svg>
  );
}

/* ─── Arc visual for bottom of hero ─── */
function HeroArc() {
  const cx = 400, cy = 320;
  const radii = [80, 120, 160, 200, 240, 280, 320, 360];
  const colors = ["#e8623a", "#c8b890", "#444", "#333", "#282828"];

  return (
    <svg
      viewBox="0 0 800 320"
      preserveAspectRatio="xMidYMax slice"
      style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%", opacity: 0.4, pointerEvents: "none" }}
    >
      {radii.map((r, i) => (
        <path
          key={r}
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={colors[i % colors.length]}
          strokeWidth={i < 2 ? 1.2 : 0.5}
          opacity={1 - i * 0.1}
        />
      ))}
      {Array.from({ length: 13 }, (_, i) => {
        const a = Math.PI + (i * Math.PI) / 12;
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + Math.cos(a) * 400} y2={cy + Math.sin(a) * 400}
            stroke="#333" strokeWidth="0.4"
          />
        );
      })}
    </svg>
  );
}

/* ─── Scroll indicator chevron ─── */
function ScrollIndicator() {
  return (
    <div
      className="anim-fade-in delay-1200"
      style={{
        position: "absolute",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 3,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        animation: "bounceY 2s ease-in-out infinite 1.5s",
        cursor: "pointer",
        opacity: 0,
      }}
      onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}
    >
      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.15em", color: "var(--text-muted)" }}>
        SCROLL
      </span>
      <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
        <path d="M1 1l7 7 7-7" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════ */
export default function LandingPage({ onLaunch }) {
  const heroRef = useRef(null);
  const [scrollY, setScrollY] = useState(0);
  const [ctaHover, setCtaHover] = useState(false);
  const [ctaPress, setCtaPress] = useState(false);

  /* ─── Scroll-triggered sections ─── */
  const [featuresRef, featuresInView] = useInView();
  const [footerRef, footerInView] = useInView({ threshold: 0.3 });

  /* ─── Parallax scroll tracking ─── */
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ─── Apply parallax to stars ─── */
  useEffect(() => {
    if (!heroRef.current) return;
    const stars = heroRef.current.querySelectorAll("[data-parallax]");
    stars.forEach((star) => {
      const speed = parseFloat(star.dataset.parallax) || 0;
      if (speed) {
        star.style.transform = `translateY(${scrollY * speed}px)`;
      }
    });
  }, [scrollY]);

  const features = [
    { num: "01", label: "Zone Selection", desc: "AI-driven polygon placement" },
    { num: "02", label: "PVGIS Irradiance", desc: "SARAH3 hourly data retrieval" },
    { num: "03", label: "Panel Layout", desc: "Shapely-based optimization" },
    { num: "04", label: "Shadow Analysis", desc: "Inter-row shadow modeling" },
    { num: "05", label: "Yield & LCOE", desc: "Energy and cost projections" },
    { num: "06", label: "3D Visualization", desc: "AI-generated site rendering" },
  ];

  const stats = [
    { value: "Live", label: "Dakhla, Morocco", dot: true },
    { value: "2,150", label: "kWh/m² annual GHI" },
    { value: "3,200+", label: "sunshine hours" },
    { value: "2026", label: "{Tech: Europe} Paris" },
  ];

  /* ─── CTA dynamic styles ─── */
  const ctaStyle = {
    padding: "18px 48px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 0,
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
    boxShadow: ctaHover
      ? "0 0 40px rgba(232, 98, 58, 0.4), 0 8px 32px rgba(232, 98, 58, 0.25)"
      : "0 0 0 rgba(232, 98, 58, 0)",
    transform: ctaPress
      ? "scale(0.97)"
      : ctaHover
        ? "translateY(-3px)"
        : "translateY(0)",
  };

  /* ─── Heading reveal offset ─── */
  const headingOpacity = Math.max(0, 1 - scrollY / 600);
  const headingTranslate = scrollY * 0.15;

  return (
    <div
      className="landing-root min-h-screen overflow-x-hidden"
      style={{ background: "var(--bg)", color: "var(--text-white)", fontFamily: SANS }}
    >
      {/* ═══════════ HERO — 100vh ═══════════ */}
      <section
        ref={heroRef}
        className="blueprint-bg"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Radial glow behind heading */}
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            width: 700,
            height: 500,
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(ellipse, rgba(232, 98, 58, 0.06) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Scattered stars with parallax speeds */}
        <Star x="14%" y="22%" size={14} delay={0} duration={5} parallaxSpeed={-0.08} />
        <Star x="82%" y="14%" size={10} delay={1.4} duration={4} parallaxSpeed={-0.12} />
        <Star x="68%" y="72%" size={12} delay={0.7} duration={6} parallaxSpeed={-0.05} />
        <Star x="24%" y="58%" size={8} delay={2.1} duration={4.5} parallaxSpeed={-0.15} />
        <Star x="91%" y="42%" size={16} delay={0.3} duration={5.5} parallaxSpeed={-0.1} />
        <Star x="6%" y="76%" size={11} delay={1.8} duration={4} parallaxSpeed={-0.06} />
        <Star x="48%" y="10%" size={9} delay={2.5} duration={5} parallaxSpeed={-0.14} />
        <Star x="36%" y="82%" size={13} delay={0.9} duration={6} color="rgba(232,97,58,0.4)" parallaxSpeed={-0.04} />

        {/* Arc visual at bottom */}
        <HeroArc />

        {/* ─── Nav ─── */}
        <nav
          className="anim-slide-down delay-0"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 40px",
            borderBottom: "1px solid var(--border-strong)",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Diamond color="#c8b890" size={14} />
            <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: "var(--text-white)" }}>
              SolarSite
            </span>
          </div>
          <button
            onClick={onLaunch}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              fontFamily: MONO,
              fontSize: 12,
              letterSpacing: "0.08em",
              cursor: "pointer",
              transition: "color 0.2s",
              padding: "8px 0",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            LAUNCH DEMO →
          </button>
        </nav>

        {/* ─── Decorative horizontal line ─── */}
        <div
          className="anim-draw-line delay-500"
          style={{
            position: "absolute",
            left: "8%",
            right: "8%",
            top: "33%",
            height: 1,
            background: "rgba(200, 184, 144, 0.10)",
            zIndex: 1,
          }}
        >
          <div style={{ position: "absolute", left: 0, top: -4 }}>
            <Diamond color="rgba(200, 184, 144, 0.25)" size={8} />
          </div>
          <div style={{ position: "absolute", left: "50%", top: -4, transform: "translateX(-50%)" }}>
            <Diamond color="rgba(200, 184, 144, 0.25)" size={8} />
          </div>
          <div style={{ position: "absolute", right: 0, top: -4 }}>
            <Diamond color="rgba(200, 184, 144, 0.25)" size={8} />
          </div>
        </div>

        {/* ─── Centered hero content (with scroll fade) ─── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 40px",
            position: "relative",
            zIndex: 2,
            opacity: headingOpacity,
            transform: `translateY(${headingTranslate}px)`,
            transition: "opacity 0.05s, transform 0.05s",
          }}
        >
          {/* Tagline */}
          <div
            className="anim-fade-up delay-200"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 40,
              fontFamily: MONO,
              fontSize: 12,
              color: "var(--text-muted)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 48,
                height: 1,
                background: "rgba(200, 184, 144, 0.3)",
                display: "block",
              }}
            />
            <span>AI-Powered Solar Assessment</span>
            <span
              style={{
                width: 48,
                height: 1,
                background: "rgba(200, 184, 144, 0.3)",
                display: "block",
              }}
            />
          </div>

          {/* Main heading — staggered line reveal */}
          <h1 style={{ marginBottom: 28, maxWidth: 800 }}>
            <span
              className="anim-fade-up delay-300"
              style={{
                fontFamily: SERIF,
                fontSize: "clamp(48px, 8vw, 104px)",
                lineHeight: 1.06,
                fontWeight: 400,
                color: "var(--text-white)",
                letterSpacing: "-0.02em",
                display: "block",
              }}
            >
              Assess sites.
            </span>
            <span
              className="anim-fade-up delay-500"
              style={{
                fontFamily: SERIF,
                fontSize: "clamp(48px, 8vw, 104px)",
                lineHeight: 1.06,
                fontWeight: 400,
                color: "var(--text-white)",
                letterSpacing: "-0.02em",
                display: "block",
              }}
            >
              Maximize yield.
            </span>
          </h1>

          {/* Description */}
          <p
            className="anim-fade-up delay-600"
            style={{
              fontFamily: SANS,
              fontSize: 16,
              lineHeight: 1.7,
              color: "var(--text-muted)",
              maxWidth: 480,
              marginBottom: 48,
            }}
          >
            Analyze irradiance, optimize panel layout, and predict energy yield
            — all from a single satellite view of Dakhla, Morocco.
          </p>

          {/* CTA with glow + press */}
          <button
            className="anim-fade-up delay-700"
            onClick={onLaunch}
            style={ctaStyle}
            onMouseEnter={() => setCtaHover(true)}
            onMouseLeave={() => { setCtaHover(false); setCtaPress(false); }}
            onMouseDown={() => setCtaPress(true)}
            onMouseUp={() => setCtaPress(false)}
          >
            LAUNCH ASSESSMENT
          </button>
        </div>

        {/* ─── Scroll indicator ─── */}
        <ScrollIndicator />

        {/* ─── Stats bar at bottom of hero ─── */}
        <div
          className="anim-fade-up delay-1000"
          style={{
            borderTop: "1px solid var(--border-strong)",
            padding: "18px 40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            zIndex: 2,
          }}
        >
          {stats.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {s.dot && (
                <span
                  className="pulse-dot"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#22c55e",
                    boxShadow: "0 0 8px rgba(34,197,94,0.4)",
                    flexShrink: 0,
                  }}
                />
              )}
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, color: "var(--text-white)" }}>
                {s.value}
              </span>
              <span style={{ fontFamily: SANS, fontSize: 13, color: "var(--text-muted)" }}>
                {s.label}
              </span>
              {i < stats.length - 1 && (
                <span
                  style={{
                    width: 1,
                    height: 14,
                    background: "var(--border-strong)",
                    marginLeft: 20,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════ FEATURES BENTO GRID ═══════════ */}
      <section
        ref={featuresRef}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          borderBottom: "1px solid var(--border-strong)",
          background: "var(--bg)",
        }}
      >
        {features.map((f, i) => (
          <div
            key={f.num}
            style={{
              padding: "28px 32px",
              borderRight: (i + 1) % 3 !== 0 ? "1px solid var(--border)" : "none",
              borderBottom: i < 3 ? "1px solid var(--border)" : "none",
              opacity: featuresInView ? 1 : 0,
              transform: featuresInView ? "translateY(0)" : "translateY(24px)",
              transition: `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.08}s, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.08}s`,
              cursor: "default",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                color: "var(--text-primary)",
                letterSpacing: "0.08em",
                display: "block",
                marginBottom: 8,
              }}
            >
              {f.num}
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontSize: 15,
                fontWeight: 500,
                color: "var(--text-white)",
                display: "block",
                marginBottom: 6,
              }}
            >
              {f.label}
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                color: "var(--text-muted)",
                letterSpacing: "0.02em",
              }}
            >
              {f.desc}
            </span>
          </div>
        ))}
      </section>

      {/* ═══════════ GIANT FOOTER ═══════════ */}
      <section
        ref={footerRef}
        className="orange-grid-overlay"
        style={{
          background: "var(--accent)",
          height: 340,
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        {/* Sun icon */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            zIndex: 2,
            opacity: footerInView ? 1 : 0,
            transform: footerInView ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="7" fill="#1c1c1c" />
            <line x1="22" y1="4" x2="22" y2="13" stroke="#1c1c1c" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="22" y1="31" x2="22" y2="40" stroke="#1c1c1c" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="4" y1="22" x2="13" y2="22" stroke="#1c1c1c" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="31" y1="22" x2="40" y2="22" stroke="#1c1c1c" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="9.3" y1="9.3" x2="15.4" y2="15.4" stroke="#1c1c1c" strokeWidth="2" strokeLinecap="round" />
            <line x1="28.6" y1="28.6" x2="34.7" y2="34.7" stroke="#1c1c1c" strokeWidth="2" strokeLinecap="round" />
            <line x1="34.7" y1="9.3" x2="28.6" y2="15.4" stroke="#1c1c1c" strokeWidth="2" strokeLinecap="round" />
            <line x1="15.4" y1="28.6" x2="9.3" y2="34.7" stroke="#1c1c1c" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Giant text — scale reveal on scroll */}
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 0,
          }}
        >
          <span
            style={{
              fontFamily: SERIF,
              fontSize: 360,
              fontWeight: 400,
              background: "linear-gradient(to bottom, #1c1c1c 50%, #0E0E0E 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              lineHeight: 0.82,
              letterSpacing: -4,
              marginBottom: "0.16em",
              opacity: footerInView ? 0.85 : 0,
              transform: footerInView ? "scale(1) translateY(0)" : "scale(0.92) translateY(30px)",
              transition: "opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            SolarSite
          </span>
        </div>
      </section>

      {/* ═══════════ BOTTOM BAR ═══════════ */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 40px",
          background: "var(--bg)",
          borderTop: "1px solid var(--border-strong)",
          fontFamily: MONO,
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        <span>© SolarSite, 2026</span>
        <span style={{ flex: 1, margin: "0 24px", borderBottom: "2px dotted #333", height: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span>All rights reserved.</span>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              color: "var(--accent)",
              textDecoration: "none",
              fontSize: 12,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ff7755")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--accent)")}
          >
            Terms of use
          </a>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              color: "var(--accent)",
              textDecoration: "none",
              fontSize: 12,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ff7755")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--accent)")}
          >
            Privacy Policy
          </a>
          <Diamond color="#e8623a" size={14} />
        </div>
      </footer>
    </div>
  );
}
