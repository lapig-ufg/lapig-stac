import { Composition } from "remotion";
import { LapigStacVideo } from "./LapigStacVideo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="LapigStacVideo"
      component={LapigStacVideo}
      durationInFrames={620}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
