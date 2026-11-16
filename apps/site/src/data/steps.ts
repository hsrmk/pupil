import importScreenshot from "../assets/screenshots/import.png";
import spaceScreenshot from "../assets/screenshots/space-stats.png";
import studyReviewScreenshot from "../assets/screenshots/study-review.png";

export type Step = {
  title: string;
  desc: string;
  src: string;
  alt: string;
};

export const STEPS: Step[] = [
  {
    title: "Import",
    desc: "Bring your existing Anki decks into Pupil, or create cards in your own spaces.",
    src: importScreenshot,
    alt: "Anki import screen",
  },
  {
    title: "Organize",
    desc: "Organize cards into spaces and keep track of your progress.",
    src: spaceScreenshot,
    alt: "Space detail screen",
  },
  {
    title: "Retain",
    desc: "FSRS-5 schedules each card at exactly the right moment. Study less time, remember far more.",
    src: studyReviewScreenshot,
    alt: "Study screen with revealed answer and FSRS Again, Hard, Good, and Easy buttons",
  },
];
