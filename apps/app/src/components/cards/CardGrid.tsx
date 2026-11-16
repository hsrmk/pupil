import type { CardRecord } from "@pupil/core";
import { useState } from "react";
import { CloseIcon } from "../icons/CloseIcon";
import { DeleteIcon } from "../icons/DeleteIcon";
import { EditIcon } from "../icons/EditIcon";
import { SuspendIcon } from "../icons/SuspendIcon";
import { Modal } from "../modal";
import { CardFace } from "./CardFace";
import styles from "./CardGrid.module.css";
import { formatDue, formatState } from "./CardList";
import { DeleteCardDialog } from "./DeleteCardDialog";

type Props = {
  cards: CardRecord[];
  onDeleteCard(id: string): void;
  onEditCard(id: string): void;
  onSuspendCard(id: string, suspended: boolean): void;
};

export function CardGrid({ cards, onDeleteCard, onEditCard, onSuspendCard }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selected = cards.find((card) => card.id === selectedId);

  if (!cards.length) return <div className={styles.empty}>No cards match the current filters.</div>;

  return (
    <>
      <div className={styles.grid}>
        {cards.map((card) => (
          <button
            aria-label={`Open card: ${card.front.replace(/!\[([^\]]*)\]\(pupil-image:[\w-]+\)/g, (_match, alt: string) => alt || "image")}`}
            className={styles.tile}
            key={card.id}
            onClick={() => setSelectedId(card.id)}
            type="button"
          >
            <span className={styles.tileBody}>
              <CardFace className={styles.front} value={card.front} />
            </span>
            <span className={styles.footer}>
              <span className={styles.hiddenSide}>+ 1 hidden side</span>
              <span className={styles.meta}>
                <span>{card.suspended ? "Suspended" : formatState(card.state)}</span>
                <span>{card.suspended ? "—" : formatDue(card.due).label}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
      <Modal
        ariaLabel="Card details"
        isOpen={Boolean(selected) && !confirmDelete}
        onClose={() => setSelectedId(null)}
        onBackdropClick={() => setSelectedId(null)}
        size="medium"
      >
        {selected ? (
          <div className={styles.detail}>
            <div className={styles.detailHead}>
              <span className={styles.detailEyebrow}>Card details</span>
              <button
                aria-label="Close card details"
                className={styles.close}
                onClick={() => setSelectedId(null)}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>
            <div className={styles.side}>
              <span className={styles.sideLabel}>Front</span>
              <CardFace className={styles.detailFace} value={selected.front} />
            </div>
            <div className={styles.side}>
              <span className={styles.sideLabel}>Back</span>
              <CardFace className={styles.detailFace} value={selected.back} />
            </div>
            {selected.tags.length ? (
              <div className={styles.tags}>
                {selected.tags.map((tag) => (
                  <span className={styles.tag} key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <div className={styles.actions}>
              <button
                onClick={() => {
                  setSelectedId(null);
                  onEditCard(selected.id);
                }}
                type="button"
              >
                <EditIcon />
                Edit
              </button>
              <button
                onClick={() => {
                  onSuspendCard(selected.id, !selected.suspended);
                  setSelectedId(null);
                }}
                type="button"
              >
                <SuspendIcon />
                {selected.suspended ? "Unsuspend" : "Suspend"}
              </button>
              <button
                className={styles.delete}
                onClick={() => setConfirmDelete(true)}
                type="button"
              >
                <DeleteIcon />
                Delete
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
      <DeleteCardDialog
        cardFront={selected?.front ?? ""}
        isOpen={confirmDelete && Boolean(selected)}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (selected) onDeleteCard(selected.id);
          setConfirmDelete(false);
          setSelectedId(null);
        }}
      />
    </>
  );
}
