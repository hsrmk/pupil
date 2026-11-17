import {
  type AnimationEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.css";

type ModalProps = {
  ariaDescribedBy?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  children: ReactNode;
  closeOnEscape?: boolean;
  isOpen: boolean;
  onBackdropClick?: () => void;
  onClose: () => void;
  overlayClassName?: string;
  panelClassName?: string;
  size?: "medium" | "small" | "wide";
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableElements(panel: HTMLElement | null): HTMLElement[] {
  return Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
    (element) => {
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    },
  );
}

// Stays mounted through the exit animation; "opening"/"closing" drive the
// keyframes in Modal.module.css and settle on the panel's animationend.
type ModalPhase = "opening" | "open" | "closing" | "closed";

// Safety net in case animationend never fires (hidden window, jsdom).
const PHASE_FALLBACK_MS = 400;

function usesPhoneLayout(): boolean {
  return window.innerWidth <= 640;
}

function revealFocusedField(panel: HTMLElement, focused: HTMLElement): void {
  if (!focused.isConnected || document.activeElement !== focused) return;
  const fieldRect = focused.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  if (fieldRect.bottom > panelRect.bottom || fieldRect.top < panelRect.top) {
    panel.scrollTop += fieldRect.top - panelRect.top - 16;
  }
}

function settlePhase(phase: ModalPhase): ModalPhase {
  if (phase === "opening") {
    return "open";
  }

  return phase === "closing" ? "closed" : phase;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function Modal({
  ariaDescribedBy,
  ariaLabel,
  ariaLabelledBy,
  children,
  closeOnEscape = true,
  isOpen,
  onBackdropClick,
  onClose,
  overlayClassName,
  panelClassName,
  size = "small",
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const [phase, setPhase] = useState<ModalPhase>(isOpen ? "opening" : "closed");
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    setPhase(isOpen ? "opening" : "closing");
  }

  // Callers often clear the state behind the dialog's content as they close
  // it; keep showing the last open render while the panel animates out.
  const childrenRef = useRef(children);
  if (isOpen) {
    childrenRef.current = children;
  }

  useEffect(() => {
    if (phase !== "opening" && phase !== "closing") {
      return;
    }

    const fallbackTimer = window.setTimeout(() => setPhase(settlePhase), PHASE_FALLBACK_MS);
    return () => window.clearTimeout(fallbackTimer);
  }, [phase]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const autofocusElement =
        panelRef.current?.querySelector<HTMLElement>("[data-modal-autofocus]");
      const firstFocusableElement = focusableElements(panelRef.current)[0];
      (autofocusElement ?? firstFocusableElement ?? panelRef.current)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousBodyOverflow;

      if (previousActiveElementRef.current?.isConnected) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const overlay = overlayRef.current;
    if (!isOpen || !viewport || !overlay) {
      return;
    }

    const updateViewport = () => {
      if (usesPhoneLayout()) {
        overlay.style.top = `${viewport.offsetTop}px`;
        overlay.style.height = `${viewport.height}px`;
        overlay.style.bottom = "auto";
      } else {
        overlay.style.removeProperty("top");
        overlay.style.removeProperty("height");
        overlay.style.removeProperty("bottom");
      }
    };

    let resizeTimer = 0;
    const handleResize = () => {
      updateViewport();
      window.clearTimeout(resizeTimer);
      if (usesPhoneLayout()) {
        resizeTimer = window.setTimeout(() => {
          const panel = panelRef.current;
          const focused = document.activeElement;
          if (
            panel &&
            focused instanceof HTMLElement &&
            focused.matches('input, textarea, [contenteditable="true"]') &&
            panel.contains(focused)
          ) {
            revealFocusedField(panel, focused);
          }
        }, 450);
      }
    };

    updateViewport();
    viewport.addEventListener("resize", handleResize);
    viewport.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", handleResize);
    return () => {
      window.clearTimeout(resizeTimer);
      viewport.removeEventListener("resize", handleResize);
      viewport.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, phase]);

  if (phase === "closed") {
    return null;
  }

  const isClosing = phase === "closing";

  function handlePanelAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      setPhase(settlePhase);
    }
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();

    if (isClosing) {
      return;
    }

    if (event.key === "Escape" && closeOnEscape) {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = focusableElements(panelRef.current);

    if (focusable.length === 0) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  function handlePanelFocus(event: FocusEvent<HTMLDivElement>) {
    const panel = event.currentTarget;
    const focused = event.target;
    if (
      !usesPhoneLayout() ||
      !(focused instanceof HTMLElement) ||
      !focused.matches('input, textarea, [contenteditable="true"]')
    ) {
      return;
    }

    window.setTimeout(() => {
      revealFocusedField(panel, focused);
    }, 450);
  }

  function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (isClosing || event.target !== event.currentTarget) {
      return;
    }

    onBackdropClick ? onBackdropClick() : onClose();
  }

  return createPortal(
    <div
      className={`${styles.modalOverlay}${overlayClassName ? ` ${overlayClassName}` : ""}`}
      data-phase={phase}
      inert={isClosing}
      onMouseDown={handleOverlayMouseDown}
      ref={overlayRef}
      role="presentation"
    >
      <div
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-modal="true"
        className={`${styles.modalPanel} ${styles[`modalPanel${capitalize(size)}`]}${panelClassName ? ` ${panelClassName}` : ""}`}
        onAnimationEnd={handlePanelAnimationEnd}
        onFocusCapture={handlePanelFocus}
        onKeyDown={handlePanelKeyDown}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        {childrenRef.current}
      </div>
    </div>,
    document.body,
  );
}
