import type { SpaceSummary } from "@pupil/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { renderCardMarkup } from "../../lib/card-markup";
import { getStorage } from "../../lib/storage";
import { useCardImages } from "../../lib/use-card-images";
import { BoldIcon } from "../icons/BoldIcon";
import { ChevronDownIcon } from "../icons/ChevronDownIcon";
import { CloseIcon } from "../icons/CloseIcon";
import { ClozeIcon } from "../icons/ClozeIcon";
import { CodeIcon } from "../icons/CodeIcon";
import { ItalicIcon } from "../icons/ItalicIcon";
import { PreviewFlipIcon } from "../icons/PreviewFlipIcon";
import { SaveIcon } from "../icons/SaveIcon";
import { TagRemoveIcon } from "../icons/TagRemoveIcon";
import { Modal } from "../modal";
import styles from "./CardFormPanel.module.css";
import { type CardEditorHandle, CardRichEditor } from "./CardRichEditor";
import { DeleteCardDialog } from "./DeleteCardDialog";

type CardDraft = {
  back: string;
  front: string;
  spaceId: string;
  tagsText: string;
};

type CardFormPanelProps = {
  draft: CardDraft;
  error: string | null;
  hasSelectedCard: boolean;
  isDeleting: boolean;
  isOpen: boolean;
  isSubmitting: boolean;
  onChange: (patch: Partial<CardDraft>) => void;
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (options: { keepOpen: boolean }) => void;
  successPulseTick?: number;
  spaces: SpaceSummary[];
};

const FRONT_LIMIT = 30;
const BACK_LIMIT = 60;

export function CardFormPanel({
  draft,
  error,
  hasSelectedCard,
  isDeleting,
  isOpen,
  isSubmitting,
  onChange,
  onClose,
  onDelete,
  onSubmit,
  successPulseTick = 0,
  spaces,
}: CardFormPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<CardEditorHandle>(null);
  const backRef = useRef<CardEditorHandle>(null);
  const frontImageInput = useRef<HTMLInputElement>(null);
  const backImageInput = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  const importingRef = useRef(false);
  draftRef.current = draft;
  const frontImages = useCardImages(draft.front);
  const backImages = useCardImages(draft.back);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isImportingImage, setIsImportingImage] = useState(false);
  const lastHandledPulseTick = useRef(0);
  const [isPreviewHovered, setIsPreviewHovered] = useState(false);
  const [makeAnother, setMakeAnother] = useState(true);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isSuccessPulsing, setIsSuccessPulsing] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");
  const [shakeKey, setShakeKey] = useState(0);

  const tags = useMemo(() => parseTags(draft.tagsText), [draft.tagsText]);
  const selectedSpaceName = spaces.find((space) => space.id === draft.spaceId)?.name ?? "Space";
  const frontWordCount = wordCount(draft.front);
  const backWordCount = wordCount(draft.back);

  useEffect(() => {
    if (!isOpen) {
      setTagInputValue("");
      setIsPreviewHovered(false);
      setMakeAnother(true);
      setIsDeleteConfirmOpen(false);
      setIsSuccessPulsing(false);
      setShakeKey(0);
      setImageError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || successPulseTick === 0 || successPulseTick === lastHandledPulseTick.current) {
      return;
    }

    lastHandledPulseTick.current = successPulseTick;
    setIsSuccessPulsing(true);
    setIsPreviewHovered(false);
    dialogRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    queueMicrotask(() => frontRef.current?.focus());

    const timeout = window.setTimeout(() => setIsSuccessPulsing(false), 420);
    return () => window.clearTimeout(timeout);
  }, [isOpen, successPulseTick]);

  if (!isOpen) {
    return null;
  }

  const isDraftClean = !draft.front.trim() && !draft.back.trim() && !draft.tagsText.trim();

  function handleBackdropClick() {
    if (isImportingImage) return;
    if (isDraftClean && !hasSelectedCard) {
      onClose();
      return;
    }
    setShakeKey((k) => k + 1);
  }

  async function importImages(files: File[], side: "front" | "back") {
    if (!files.length || importingRef.current) return;
    importingRef.current = true;
    setIsImportingImage(true);
    setImageError(null);
    const field = side === "front" ? frontRef.current : backRef.current;
    let start = field?.selectionStart ?? draftRef.current[side].length;
    let end = field?.selectionEnd ?? start;
    try {
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) throw new Error("Images must be 10 MB or smaller.");
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            typeof reader.result === "string"
              ? resolve(reader.result.split(",")[1] ?? "")
              : reject(new Error("Could not read image."));
          reader.onerror = () => reject(new Error("Could not read image."));
          reader.readAsDataURL(file);
        });
        const id = await getStorage().saveCardImage(data);
        const alt = (file.name.replace(/\.[^.]+$/, "") || "Image").replace(/[[\]\n]/g, " ");
        const markdown = `![${alt}](pupil-image:${id})`;
        const current = draftRef.current[side];
        const next = `${current.slice(0, start)}${markdown}${current.slice(end)}`;
        draftRef.current = { ...draftRef.current, [side]: next };
        onChange({ [side]: next });
        start += markdown.length;
        end = start;
      }
      queueMicrotask(() => {
        field?.focus();
        field?.setSelectionRange(start, start);
      });
    } catch (cause) {
      setImageError(cause instanceof Error ? cause.message : "Could not import image.");
    } finally {
      importingRef.current = false;
      setIsImportingImage(false);
    }
  }

  return (
    <Modal
      ariaDescribedBy={error ? "card-form-error" : "card-form-description"}
      ariaLabelledBy="card-form-title"
      closeOnEscape={!isSubmitting && !isDeleting && !isImportingImage}
      isOpen={isOpen}
      onBackdropClick={handleBackdropClick}
      onClose={onClose}
      overlayClassName={styles.cardBackdrop}
      panelClassName={`${styles.cardDialog}${isSuccessPulsing ? ` ${styles.successPulse}` : ""}`}
      size="wide"
    >
      <div className={styles.newCardStickyTop}>
        <div className={styles.newCardHead}>
          <div>
            <h2 className={styles.newCardTitle} id="card-form-title">
              {hasSelectedCard ? "Edit Card" : "New Card"}
            </h2>
            <p className={styles.newCardDescription} id="card-form-description">
              Write a focused prompt/answer pair. Keep the front atomic and the back tight. Use
              $...$ or $$...$$ for math; add, paste, or drop images into either side.
            </p>
          </div>
          <button
            aria-label="Close"
            className={styles.newCardCloseButton}
            disabled={isImportingImage}
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <div className={styles.newCardActionsBar}>
          {!hasSelectedCard ? (
            <button
              aria-pressed={makeAnother}
              className={`${styles.newCardMakeAnother}${makeAnother ? ` ${styles.active}` : ""}`}
              onClick={() => setMakeAnother((current) => !current)}
              type="button"
            >
              <span className={styles.newCardMakeAnotherLabel}>Make another</span>
              <span className={styles.newCardToggleTrack}>
                <span className={styles.newCardToggleThumb} />
              </span>
            </button>
          ) : (
            <span />
          )}

          <div
            className={`${styles.newCardActionsRight}${shakeKey > 0 ? ` ${styles.shake}` : ""}`}
            key={shakeKey}
          >
            {hasSelectedCard ? (
              <button
                className={`${styles.newCardDiscardBtn} ${styles.danger}`}
                disabled={isDeleting || isSubmitting || isImportingImage}
                onClick={() => setIsDeleteConfirmOpen(true)}
                type="button"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            ) : (
              <button
                className={styles.newCardDiscardBtn}
                disabled={isImportingImage}
                onClick={onClose}
                type="button"
              >
                Discard
              </button>
            )}

            <button
              className={styles.newCardSaveBtn}
              disabled={isSubmitting || isDeleting || isImportingImage}
              onClick={() => onSubmit({ keepOpen: !hasSelectedCard && makeAnother })}
              type="button"
            >
              <SaveIcon />
              {isSubmitting
                ? hasSelectedCard
                  ? "Saving..."
                  : "Creating..."
                : hasSelectedCard
                  ? "Save changes"
                  : "Save card"}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.newCardDialogForm} ref={dialogRef}>
        <div className={styles.newCardEditorSection}>
          <div className={styles.newCardEditorPair}>
            <div className={styles.newCardFieldBlock}>
              <div className={styles.newCardFieldChrome}>
                <span className={styles.newCardFieldLabel}>Front</span>
                <span
                  className={`${styles.newCardWordCount}${wordCountClassName(frontWordCount, FRONT_LIMIT, styles)}`}
                >
                  {frontWordCount} / {FRONT_LIMIT} words
                </span>
              </div>

              <div className={`${styles.newCardToolbar} ${styles.frontToolbar}`}>
                <button
                  className={styles.newCardFmtBtn}
                  onClick={() =>
                    insertFormat(frontRef.current, draft.front, onChange, "front", "**", "**")
                  }
                  title="Bold"
                  type="button"
                >
                  <BoldIcon />
                </button>
                <button
                  className={styles.newCardFmtBtn}
                  onClick={() =>
                    insertFormat(frontRef.current, draft.front, onChange, "front", "*", "*")
                  }
                  title="Italic"
                  type="button"
                >
                  <ItalicIcon />
                </button>
                <button
                  className={styles.newCardFmtBtn}
                  onClick={() =>
                    insertFormat(frontRef.current, draft.front, onChange, "front", "`", "`")
                  }
                  title="Code"
                  type="button"
                >
                  <CodeIcon />
                </button>
                <span className={styles.newCardFmtSep} />
                <button
                  className={styles.newCardFmtBtn}
                  onClick={() =>
                    insertCloze(
                      frontRef.current,
                      backRef.current,
                      draft.front,
                      draft.back,
                      onChange,
                    )
                  }
                  title="Cloze"
                  type="button"
                >
                  <ClozeIcon />
                </button>
                <button
                  className={`${styles.newCardFmtBtn} ${styles.imageButton}`}
                  title="Add image to front"
                  type="button"
                  onClick={() => frontImageInput.current?.click()}
                >
                  ＋ Image
                </button>
                <input
                  ref={frontImageInput}
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  multiple
                  onChange={(event) => {
                    void importImages(Array.from(event.target.files ?? []), "front");
                    event.target.value = "";
                  }}
                />
                <span className={styles.newCardFmtHint}>Markdown + LaTeX</span>
              </div>

              <CardRichEditor
                className={`${styles.newCardTextarea} ${styles.front}`}
                label="Front"
                placeholder="A clear, single question or prompt..."
                ref={frontRef}
                value={draft.front}
                images={frontImages}
                disabled={isImportingImage}
                onChange={(value) => onChange({ front: value })}
                onFiles={(files) => {
                  void importImages(files, "front");
                }}
                autoFocus
              />

              <div
                className={`${styles.newCardLimitGuidance}${frontWordCount > FRONT_LIMIT ? ` ${styles.over}` : ""}`}
              >
                {frontWordCount > FRONT_LIMIT
                  ? `${frontWordCount - FRONT_LIMIT} word${frontWordCount - FRONT_LIMIT === 1 ? "" : "s"} over. Can this be tighter?`
                  : "One question. One concept. No compound prompts."}
              </div>
            </div>

            <div className={styles.newCardFieldBlock}>
              <div className={styles.newCardFieldChrome}>
                <span className={styles.newCardFieldLabel}>Back</span>
                <span
                  className={`${styles.newCardWordCount}${wordCountClassName(backWordCount, BACK_LIMIT, styles)}`}
                >
                  {backWordCount} / {BACK_LIMIT} words
                </span>
              </div>

              <div className={styles.newCardToolbar}>
                <button
                  className={styles.newCardFmtBtn}
                  onClick={() =>
                    insertFormat(backRef.current, draft.back, onChange, "back", "**", "**")
                  }
                  title="Bold"
                  type="button"
                >
                  <BoldIcon />
                </button>
                <button
                  className={styles.newCardFmtBtn}
                  onClick={() =>
                    insertFormat(backRef.current, draft.back, onChange, "back", "*", "*")
                  }
                  title="Italic"
                  type="button"
                >
                  <ItalicIcon />
                </button>
                <button
                  className={styles.newCardFmtBtn}
                  onClick={() =>
                    insertFormat(backRef.current, draft.back, onChange, "back", "`", "`")
                  }
                  title="Code"
                  type="button"
                >
                  <CodeIcon />
                </button>
                <button
                  className={`${styles.newCardFmtBtn} ${styles.imageButton}`}
                  title="Add image to back"
                  type="button"
                  onClick={() => backImageInput.current?.click()}
                >
                  ＋ Image
                </button>
                <input
                  ref={backImageInput}
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  multiple
                  onChange={(event) => {
                    void importImages(Array.from(event.target.files ?? []), "back");
                    event.target.value = "";
                  }}
                />
                <span className={styles.newCardFmtHint}>Markdown + LaTeX</span>
              </div>

              <CardRichEditor
                className={`${styles.newCardTextarea} ${styles.back}`}
                label="Back"
                placeholder="A direct answer. Just enough context to be unambiguous..."
                ref={backRef}
                value={draft.back}
                images={backImages}
                disabled={isImportingImage}
                onChange={(value) => onChange({ back: value })}
                onFiles={(files) => {
                  void importImages(files, "back");
                }}
              />

              <div
                className={`${styles.newCardLimitGuidance}${backWordCount > BACK_LIMIT ? ` ${styles.over}` : ""}`}
              >
                {backWordCount > BACK_LIMIT
                  ? `${backWordCount - BACK_LIMIT} word${backWordCount - BACK_LIMIT === 1 ? "" : "s"} over. Try splitting into two cards.`
                  : "Answer the front, then stop. If you need a paragraph, the card is too broad."}
              </div>
            </div>
          </div>
          {imageError ? <p role="alert">{imageError}</p> : null}
        </div>

        <div className={styles.newCardTagsSection}>
          <div className={styles.newCardSectionChrome}>
            <span className={styles.newCardFieldLabel}>Tags</span>
            <span className={`${styles.newCardWordCount} ${styles.subdued}`}>optional</span>
          </div>
          <div className={styles.newCardTagsInputWrap}>
            {tags.map((tag) => (
              <span className={styles.newCardTagPill} key={tag}>
                {tag}
                <button
                  className={styles.newCardTagRemove}
                  onClick={() =>
                    onChange({ tagsText: tags.filter((item) => item !== tag).join(", ") })
                  }
                  type="button"
                >
                  <TagRemoveIcon />
                </button>
              </span>
            ))}
            <input
              className={styles.newCardTagInput}
              onChange={(event) => setTagInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  const nextTag = normalizeTag(tagInputValue);

                  if (!nextTag || tags.includes(nextTag)) {
                    setTagInputValue("");
                    return;
                  }

                  onChange({ tagsText: [...tags, nextTag].join(", ") });
                  setTagInputValue("");
                }

                if (event.key === "Backspace" && !tagInputValue && tags.length > 0) {
                  onChange({ tagsText: tags.slice(0, -1).join(", ") });
                }
              }}
              placeholder="Add tag..."
              value={tagInputValue}
            />
          </div>
        </div>

        <div className={styles.newCardSpaceSection}>
          <div className={styles.newCardSectionChrome}>
            <span className={styles.newCardFieldLabel}>Space</span>
          </div>
          <div className={styles.newCardSelectWrap}>
            <select
              className={styles.newCardSelectInput}
              onChange={(event) => onChange({ spaceId: event.target.value })}
              value={draft.spaceId}
            >
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
            <span className={styles.newCardSelectChevron}>
              <ChevronDownIcon />
            </span>
          </div>
        </div>

        {error ? (
          <p className={styles.newCardError} id="card-form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.newCardDivider} />

        <div className={styles.newCardPreviewSection}>
          <div className={styles.newCardPreviewHeader}>
            <span className={styles.newCardPreviewLabel}>Preview</span>
            <span className={styles.newCardPreviewHint}>
              <PreviewFlipIcon />
              Hover to flip
            </span>
          </div>

          <div
            className={`${styles.newCardScene}${isPreviewHovered ? ` ${styles.hovered}` : ""}`}
            onMouseEnter={() => setIsPreviewHovered(true)}
            onMouseLeave={() => setIsPreviewHovered(false)}
          >
            <div
              className={`${styles.newCardBody}${isPreviewHovered ? ` ${styles.hovered}` : ""}`}
              role="presentation"
            >
              <div className={`${styles.newCardFace} ${styles.newCardFaceFront}`}>
                <span className={`${styles.newCardCorner} ${styles.tl}`}>front</span>
                <div className={styles.newCardFaceInner}>
                  <div
                    className={styles.newCardFaceText}
                    dangerouslySetInnerHTML={{
                      __html: renderPreviewHtml(
                        draft.front,
                        "Start typing...",
                        styles.newCardFaceEmpty,
                        styles.newCardClozeBlank,
                        frontImages,
                      ),
                    }}
                  />
                </div>
                {tags.length > 0 ? (
                  <div className={styles.newCardFaceTags}>
                    {tags.map((tag) => (
                      <span className={styles.newCardFaceTag} key={`preview-${tag}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <span className={`${styles.newCardCorner} ${styles.br}`}>{selectedSpaceName}</span>
              </div>

              <div className={`${styles.newCardFace} ${styles.newCardFaceBack}`}>
                <span className={`${styles.newCardCorner} ${styles.tl}`}>back</span>
                <div className={styles.newCardFaceInner}>
                  <div
                    className={`${styles.newCardFaceText} ${styles.back}`}
                    dangerouslySetInnerHTML={{
                      __html: renderPreviewHtml(
                        draft.back,
                        "Start typing...",
                        styles.newCardFaceEmpty,
                        styles.newCardClozeBlank,
                        backImages,
                      ),
                    }}
                  />
                </div>
                <span className={`${styles.newCardCorner} ${styles.br}`}>{selectedSpaceName}</span>
              </div>
            </div>
          </div>

          <div className={styles.newCardDots}>
            <span
              className={`${styles.newCardDot}${!isPreviewHovered ? ` ${styles.active}` : ""}`}
            />
            <span
              className={`${styles.newCardDot}${isPreviewHovered ? ` ${styles.active}` : ""}`}
            />
          </div>
        </div>

        <div className={styles.newCardOpinionBox}>
          <div className={styles.newCardOpinionTitle}>What makes a good card</div>
          <div className={styles.newCardOpinionList}>
            <div className={styles.newCardOpinionItem}>
              <span className={styles.newCardOpinionBullet} />
              <span>
                <strong>Front: 30 words max.</strong> One question testing one atomic piece of
                knowledge.
              </span>
            </div>
            <div className={styles.newCardOpinionItem}>
              <span className={styles.newCardOpinionBullet} />
              <span>
                <strong>Back: 60 words max.</strong> A direct answer with just enough context.
              </span>
            </div>
            <div className={styles.newCardOpinionItem}>
              <span className={styles.newCardOpinionBullet} />
              <span>
                <strong>Use formatting sparingly.</strong> Bold a key term, code-wrap a function,
                and keep it scannable.
              </span>
            </div>
            <div className={styles.newCardOpinionItem}>
              <span className={styles.newCardOpinionBullet} />
              <span>
                <strong>Cloze cards:</strong> use <code>_____</code> on the front and put the answer
                on the back.
              </span>
            </div>
          </div>
        </div>
      </div>

      <DeleteCardDialog
        cardFront={draft.front}
        isDeleting={isDeleting}
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => {
          setIsDeleteConfirmOpen(false);
          onDelete();
        }}
      />
    </Modal>
  );
}

function wordCount(value: string): number {
  const trimmed = value.replace(/!\[[^\]\n]*\]\(pupil-image:[\w-]+\)/g, " ").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function wordCountClassName(count: number, limit: number, s: Record<string, string>): string {
  if (count > limit) {
    return ` ${s.over}`;
  }

  if (count > limit * 0.8) {
    return ` ${s.warn}`;
  }

  return "";
}

function normalizeTag(value: string): string {
  return value.trim().replace(/,/g, "").toLowerCase();
}

function parseTags(tagsText: string): string[] {
  return tagsText
    .split(",")
    .map((tag) => normalizeTag(tag))
    .filter((tag, index, allTags) => tag.length > 0 && allTags.indexOf(tag) === index);
}

function insertFormat(
  element: CardEditorHandle | null,
  value: string,
  onChange: (patch: Partial<CardDraft>) => void,
  field: "front" | "back",
  prefix: string,
  suffix: string,
) {
  if (!element) {
    return;
  }

  const start = element.selectionStart;
  const end = element.selectionEnd;
  const selection = value.slice(start, end);
  const nextValue = selection
    ? `${value.slice(0, start)}${prefix}${selection}${suffix}${value.slice(end)}`
    : `${value.slice(0, start)}${prefix}${suffix}${value.slice(end)}`;
  const caretPosition = start + prefix.length;

  onChange({ [field]: nextValue });

  queueMicrotask(() => {
    element.focus();
    const selectionEnd = selection ? end + prefix.length : caretPosition;
    element.setSelectionRange(caretPosition, selectionEnd);
  });
}

function insertCloze(
  frontElement: CardEditorHandle | null,
  backElement: CardEditorHandle | null,
  frontValue: string,
  backValue: string,
  onChange: (patch: Partial<CardDraft>) => void,
) {
  if (!frontElement) {
    return;
  }

  const start = frontElement.selectionStart;
  const end = frontElement.selectionEnd;
  const selection = frontValue.slice(start, end).trim();
  const nextFront = `${frontValue.slice(0, start)}_____${frontValue.slice(end)}`;
  const patch: Partial<CardDraft> = { front: nextFront };

  if (selection && !backValue.trim()) {
    patch.back = selection;
  }

  onChange(patch);

  queueMicrotask(() => {
    frontElement.focus();
    frontElement.setSelectionRange(start + 5, start + 5);
    if (selection && !backValue.trim() && backElement) {
      backElement.focus();
      backElement.setSelectionRange(selection.length, selection.length);
    }
  });
}

function renderPreviewHtml(
  value: string,
  emptyLabel: string,
  emptyClassName: string,
  clozeClassName: string,
  images: Readonly<Record<string, string>>,
): string {
  if (!value.trim()) {
    return `<span class="${emptyClassName}">${emptyLabel}</span>`;
  }

  return renderCardMarkup(value, clozeClassName, images);
}
