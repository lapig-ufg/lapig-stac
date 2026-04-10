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

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgRotation = interpolate(frame, [0, 120], [0, -15], {
    extrapolateRight: "clamp",
  });

  // Logo
  const logoProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  // Title
  const titleProgress = spring({
    frame,
    fps,
    delay: Math.round(0.4 * fps),
    config: { damping: 200 },
  });

  // Links
  const linkItems = [
    "github.com/lapig-ufg/lapig-stac",
    "stacspec.org",
    "mapbiomas.org",
  ];

  const linkProgresses = linkItems.map((_, i) =>
    spring({
      frame,
      fps,
      delay: Math.round((0.8 + i * 0.2) * fps),
      config: { damping: 200 },
    })
  );

  // Divider
  const dividerWidth = interpolate(
    spring({ frame, fps, delay: Math.round(0.6 * fps), config: { damping: 200 } }),
    [0, 1],
    [0, 200]
  );

  // Credits
  const creditsProgress = spring({
    frame,
    fps,
    delay: Math.round(1.6 * fps),
    config: { damping: 200 },
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${135 + bgRotation}deg, ${COLORS.darkBg} 0%, ${COLORS.darkGreen} 50%, ${COLORS.green} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Grid pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Logo */}
        <Img
          src={staticFile("logo-claro.png")}
          style={{
            width: 200,
            height: "auto",
            filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.3))",
            transform: `scale(${logoProgress})`,
          }}
        />

        {/* Title */}
        <h1
          style={{
            fontFamily: montserrat,
            fontSize: 52,
            fontWeight: 800,
            color: COLORS.white,
            margin: 0,
            opacity: titleProgress,
            textShadow: "0 2px 16px rgba(0,0,0,0.3)",
          }}
        >
          Comece a explorar
        </h1>

        {/* Divider */}
        <div
          style={{
            width: dividerWidth,
            height: 2,
            backgroundColor: `${COLORS.lightGreen}80`,
            borderRadius: 1,
            marginTop: 8,
            marginBottom: 8,
          }}
        />

        {/* Links */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          {linkItems.map((link, i) => (
            <span
              key={i}
              style={{
                fontFamily: inter,
                fontSize: 22,
                fontWeight: 500,
                color: COLORS.paleGreen,
                opacity: linkProgresses[i],
                transform: `translateY(${interpolate(linkProgresses[i], [0, 1], [20, 0])}px)`,
              }}
            >
              {link}
            </span>
          ))}
        </div>

        {/* Credits */}
        <div
          style={{
            marginTop: 40,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            opacity: creditsProgress,
          }}
        >
          <span
            style={{
              fontFamily: inter,
              fontSize: 15,
              fontWeight: 400,
              color: `${COLORS.lightGreen}99`,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Desenvolvido por
          </span>
          <span
            style={{
              fontFamily: montserrat,
              fontSize: 20,
              fontWeight: 600,
              color: COLORS.white,
            }}
          >
            LAPIG &bull; Universidade Federal de Goiás
          </span>
          <span
            style={{
              fontFamily: inter,
              fontSize: 14,
              fontWeight: 400,
              color: `${COLORS.lightGreen}80`,
              marginTop: 4,
            }}
          >
            Dados: CC-BY-SA-4.0 &bull; Código aberto
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
