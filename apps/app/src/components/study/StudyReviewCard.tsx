import { renderCardMarkup } from "../../lib/card-markup";
import { useCardImages } from "../../lib/use-card-images";
import styles from "./Study.module.css";
import type { StudyCardRecord } from "./types";

type StudyReviewCardProps = {
  card: StudyCardRecord;
  isAnswerVisible: boolean;
  isSuspended?: boolean;
};

export function StudyReviewCard({
  card,
  isAnswerVisible,
  isSuspended = false,
}: StudyReviewCardProps) {
  const frontImages = useCardImages(card.front);
  const backImages = useCardImages(card.back);
  return (
    <div
      className={`${styles.sessionCard}${isAnswerVisible ? ` ${styles.flipped}` : ""}${isSuspended ? ` ${styles.suspended}` : ""}`}
    >
      <div className={`${styles.sessionCardFace} ${styles.front}`}>
        <span className={styles.sessionCardLabel}>front</span>
        <span className={styles.sessionCardSpace}>{card.spaceName}</span>
        <div className={styles.sessionCardContent}>
          <div
            className={styles.sessionCardText}
            dangerouslySetInnerHTML={{
              __html: renderCardMarkup(card.front, "session-cloze-blank", frontImages),
            }}
          />
        </div>
        {card.tags.length > 0 ? (
          <div className={styles.sessionCardTags}>
            {card.tags.map((tag) => (
              <span className={styles.sessionCardTag} key={`${card.id}-${tag}-front`}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`${styles.sessionCardFace} ${styles.back}`}>
        <span className={styles.sessionCardLabel}>back</span>
        <span className={styles.sessionCardSpace}>{card.spaceName}</span>
        <div className={styles.sessionCardContent}>
          <div
            className={styles.sessionCardFrontEcho}
            dangerouslySetInnerHTML={{
              __html: renderCardMarkup(card.front, "session-cloze-blank", frontImages),
            }}
          />
          <div
            className={styles.sessionCardText}
            dangerouslySetInnerHTML={{
              __html: renderCardMarkup(card.back, "session-cloze-blank", backImages),
            }}
          />
        </div>
        {card.tags.length > 0 ? (
          <div className={styles.sessionCardTags}>
            {card.tags.map((tag) => (
              <span className={styles.sessionCardTag} key={`${card.id}-${tag}-back`}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
