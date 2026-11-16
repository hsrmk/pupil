import { EyeLogo } from "../brand";
import { CreateSpaceIcon, ImportDeckIcon } from "../icons/OnboardingIcons";
import styles from "./Onboarding.module.css";
import { OnboardingPathCard } from "./OnboardingPathCard";
import { OnboardingQuickStart } from "./OnboardingQuickStart";

type OnboardingScreenProps = {
  onCreateSpace: () => void;
  onImport: () => void;
  onSkip: () => void;
};

export function OnboardingScreen({ onCreateSpace, onImport, onSkip }: OnboardingScreenProps) {
  return (
    <>
      <div className={styles.welcomeTitlebar} data-window-drag />

      <div className={styles.welcomePage}>
        <div className={styles.welcomeHero}>
          <div className={styles.welcomeHeroEye}>
            <EyeLogo className={styles.welcomeEyeLogo} height={64} width={64} />
          </div>

          <div className={styles.welcomeHeroWordmark}>pupil</div>

          <p className={styles.welcomeHeroDesc}>
            Local-first flashcards with spaced repetition. Everything stays on your machine. Pick a
            starting point below.
          </p>
        </div>

        <div className={styles.welcomePathsSection}>
          <div className={styles.welcomePathsLabel}>Get started</div>

          <div className={styles.welcomePathsGrid}>
            <OnboardingPathCard
              ctaLabel="Create"
              description="Start from scratch. Name a topic and add cards manually, one at a time."
              icon={<CreateSpaceIcon />}
              onClick={onCreateSpace}
              title="Create a space"
            />

            <OnboardingPathCard
              ctaLabel="Import"
              description={
                <>
                  Drop an <code>.apkg</code> file. Your decks become spaces, cards get fresh FSRS
                  scheduling.
                </>
              }
              icon={<ImportDeckIcon />}
              onClick={onImport}
              title="Import from Anki"
            />
          </div>
        </div>

        <div className={styles.welcomeOrRow}>
          <div className={styles.welcomeOrLine} />
          <span className={styles.welcomeOrText}>or skip ahead</span>
          <div className={styles.welcomeOrLine} />
        </div>

        <div className={styles.welcomeQuickstart}>
          <OnboardingQuickStart onClick={onSkip} />
        </div>
      </div>
    </>
  );
}
