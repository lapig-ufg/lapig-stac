import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

export const { fontFamily: montserrat } = loadMontserrat("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

export const { fontFamily: inter } = loadInter("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});
