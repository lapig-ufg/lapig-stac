import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS } from "../colors";
import { montserrat, inter } from "../fonts";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animated gradient background
  const bgRotation = interpolate(frame, [0, 150], [0, 30], {
    extrapolateRight: "clamp",
  });

  // Logo entrance — spring scale
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
    durationInFrames: Math.round(1.2 * fps),
  });

  // Logo glow pulse
  const glowOpacity = interpolate(
    frame,
    [30, 60, 90],
    [0, 0.6, 0.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Title — slide up with spring
  const titleProgress = spring({
    frame,
    fps,
    delay: Math.round(0.6 * fps),
    config: { damping: 200 },
  });
  const titleY = interpolate(titleProgress, [0, 1], [60, 0]);
  const titleOpacity = titleProgress;

  // Subtitle — fade in
  const subtitleProgress = spring({
    frame,
    fps,
    delay: Math.round(1.2 * fps),
    config: { damping: 200 },
  });
  const subtitleY = interpolate(subtitleProgress, [0, 1], [40, 0]);

  // Tagline — fade in
  const taglineProgress = spring({
    frame,
    fps,
    delay: Math.round(1.8 * fps),
    config: { damping: 200 },
  });

  // Decorative particles
  const particles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    const radius = interpolate(
      frame,
      [20 + i * 5, 60 + i * 5],
      [0, 300 + i * 40],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    const x = Math.cos(angle + frame * 0.01) * radius;
    const y = Math.sin(angle + frame * 0.01) * radius;
    const particleOpacity = interpolate(
      frame,
      [20 + i * 5, 40 + i * 5, 120],
      [0, 0.15, 0.05],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    return { x, y, opacity: particleOpacity, size: 4 + i * 2 };
  });

  // Version badge
  const badgeProgress = spring({
    frame,
    fps,
    delay: Math.round(2.2 * fps),
    config: { damping: 15, stiffness: 120 },
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${135 + bgRotation}deg, ${COLORS.darkBg} 0%, ${COLORS.darkGreen} 40%, ${COLORS.green} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Subtle grid pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Decorative particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `calc(50% + ${p.x}px)`,
            top: `calc(50% + ${p.y}px)`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: COLORS.lightGreen,
            opacity: p.opacity,
          }}
        />
      ))}

      {/* Logo glow */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.lightGreen}40, transparent 70%)`,
          opacity: glowOpacity,
          top: "calc(50% - 260px)",
        }}
      />

      {/* Logo */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          transform: `scale(${logoScale})`,
        }}
      >
        <Img
          src={staticFile("logo-claro.png")}
          style={{
            width: 280,
            height: "auto",
            filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.4))",
          }}
        />
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: "58%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <h1
          style={{
            fontFamily: montserrat,
            fontSize: 64,
            fontWeight: 800,
            color: COLORS.white,
            letterSpacing: -1,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            textShadow: "0 4px 20px rgba(0,0,0,0.3)",
            margin: 0,
          }}
        >
          Catálogo STAC
        </h1>

        <p
          style={{
            fontFamily: inter,
            fontSize: 28,
            fontWeight: 500,
            color: COLORS.paleGreen,
            opacity: subtitleProgress,
            transform: `translateY(${subtitleY}px)`,
            margin: 0,
            letterSpacing: 1,
          }}
        >
          Dados geoespaciais de pastagem do Brasil
        </p>

        <p
          style={{
            fontFamily: inter,
            fontSize: 20,
            fontWeight: 400,
            color: `${COLORS.lightGreen}cc`,
            opacity: taglineProgress,
            margin: 0,
            marginTop: 8,
          }}
        >
          LAPIG/UFG &bull; MapBiomas Col. 10 &bull; STAC v1.1.0
        </p>

        {/* Version badge */}
        <div
          style={{
            marginTop: 16,
            padding: "8px 24px",
            borderRadius: 20,
            border: `1px solid ${COLORS.lightGreen}60`,
            backgroundColor: `${COLORS.darkGreen}80`,
            opacity: badgeProgress,
            transform: `scale(${badgeProgress})`,
          }}
        >
          <span
            style={{
              fontFamily: inter,
              fontSize: 14,
              fontWeight: 600,
              color: COLORS.lightGreen,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Open Data &bull; COG &bull; GeoParquet
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
