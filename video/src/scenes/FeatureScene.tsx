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

type FeatureSceneProps = {
  title: string;
  description: string;
  imageName: string;
  featureItems: string[];
  accentColor?: string;
  imagePosition?: "right" | "left";
};

export const FeatureScene: React.FC<FeatureSceneProps> = ({
  title,
  description,
  imageName,
  featureItems,
  accentColor = COLORS.green,
  imagePosition = "right",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background subtle animation
  const bgShift = interpolate(frame, [0, 150], [0, 10], {
    extrapolateRight: "clamp",
  });

  // Title entrance
  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 5,
  });
  const titleX = interpolate(
    titleProgress,
    [0, 1],
    [imagePosition === "right" ? -80 : 80, 0]
  );

  // Description entrance
  const descProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 12,
  });

  // Screenshot entrance — slide in from side with shadow reveal
  const imgProgress = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
    delay: 8,
  });
  const imgX = interpolate(
    imgProgress,
    [0, 1],
    [imagePosition === "right" ? 120 : -120, 0]
  );
  const imgShadow = interpolate(imgProgress, [0, 1], [0, 40]);

  // Feature items — staggered entrance
  const itemProgresses = featureItems.map((_, i) =>
    spring({
      frame,
      fps,
      config: { damping: 200 },
      delay: 18 + i * 6,
    })
  );

  // Accent line
  const lineWidth = interpolate(
    spring({ frame, fps, config: { damping: 200 }, delay: 3 }),
    [0, 1],
    [0, 60]
  );

  const isRight = imagePosition === "right";

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${isRight ? 160 : 200}deg, ${COLORS.offWhite} 0%, ${COLORS.paleGreen} 100%)`,
        padding: 80,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 60,
        overflow: "hidden",
      }}
    >
      {/* Decorative circle */}
      <div
        style={{
          position: "absolute",
          right: isRight ? -200 : undefined,
          left: isRight ? undefined : -200,
          top: -200 + bgShift,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `${accentColor}10`,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: isRight ? 100 : undefined,
          left: isRight ? undefined : 100,
          bottom: -300 + bgShift,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `${accentColor}08`,
        }}
      />

      {/* Text side */}
      <div
        style={{
          flex: "0 0 480px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          order: isRight ? 0 : 1,
          zIndex: 1,
        }}
      >
        {/* Accent line */}
        <div
          style={{
            width: lineWidth,
            height: 4,
            backgroundColor: accentColor,
            borderRadius: 2,
            marginBottom: 8,
          }}
        />

        <h2
          style={{
            fontFamily: montserrat,
            fontSize: 48,
            fontWeight: 700,
            color: COLORS.darkGreen,
            margin: 0,
            lineHeight: 1.1,
            opacity: titleProgress,
            transform: `translateX(${titleX}px)`,
          }}
        >
          {title}
        </h2>

        <p
          style={{
            fontFamily: inter,
            fontSize: 20,
            fontWeight: 400,
            color: COLORS.textMuted,
            margin: 0,
            lineHeight: 1.6,
            opacity: descProgress,
          }}
        >
          {description}
        </p>

        {/* Feature list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 16,
          }}
        >
          {featureItems.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                opacity: itemProgresses[i],
                transform: `translateX(${interpolate(itemProgresses[i], [0, 1], [30, 0])}px)`,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: accentColor,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: inter,
                  fontSize: 17,
                  fontWeight: 500,
                  color: COLORS.textDark,
                }}
              >
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Image side */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          order: isRight ? 1 : 0,
          zIndex: 1,
        }}
      >
        <div
          style={{
            transform: `translateX(${imgX}px)`,
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: `0 ${imgShadow}px ${imgShadow * 2}px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)`,
          }}
        >
          <Img
            src={staticFile(imageName)}
            style={{
              width: 1100,
              height: "auto",
              display: "block",
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
