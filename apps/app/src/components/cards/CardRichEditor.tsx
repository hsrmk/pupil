import katex from "katex";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import styles from "./CardRichEditor.module.css";

export type CardEditorHandle = {
  readonly selectionStart: number;
  readonly selectionEnd: number;
  focus(): void;
  setSelectionRange(start: number, end: number): void;
};

type Props = {
  value: string;
  images: Readonly<Record<string, string>>;
  placeholder: string;
  label: string;
  disabled: boolean;
  onChange(value: string): void;
  onFiles(files: File[]): void;
  autoFocus?: boolean;
  className?: string;
};

const tokenPattern =
  /`([^`\n]+)`|!\[([^\]\n]*)\]\(pupil-image:([\w-]+)\)|\$\$([\s\S]+?)\$\$|(?<![\\$])\$([^$\n]+?)(?<!\\)\$(?!\$)/g;

function activeMathAt(value: string, start: number, end: number): number | null {
  for (const match of value.matchAll(tokenPattern)) {
    if (
      (match[4] !== undefined || match[5] !== undefined) &&
      start < match.index + match[0].length &&
      end >= match.index
    )
      return match.index;
  }
  return null;
}

function serialize(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node instanceof HTMLElement) {
    const markdown = node.dataset.markdown;
    if (markdown !== undefined) return markdown;
    if (node.tagName === "BR") return "\n";
  }
  return Array.from(node.childNodes)
    .map((child, index) => {
      const prefix =
        index > 0 && child instanceof HTMLElement && child.tagName === "DIV" ? "\n" : "";
      if (
        child instanceof HTMLElement &&
        child.tagName === "DIV" &&
        child.childNodes.length === 1 &&
        child.firstChild instanceof HTMLBRElement
      )
        return prefix;
      return prefix + serialize(child);
    })
    .join("");
}

function offsetIn(editor: HTMLElement, end: boolean): number {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode))
    return serialize(editor).length;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(editor);
  const current = selection.getRangeAt(0);
  range.setEnd(
    end ? current.endContainer : current.startContainer,
    end ? current.endOffset : current.startOffset,
  );
  return serialize(range.cloneContents()).length;
}

// Locate the closest caret boundary in the normalized direct-child representation.
function locate(editor: HTMLElement, position: number): [Node, number] {
  let remaining = position;
  for (const [index, child] of Array.from(editor.childNodes).entries()) {
    const length = serialize(child).length;
    if (remaining <= length) {
      if (child.nodeType === Node.TEXT_NODE) return [child, Math.min(remaining, length)];
      return [editor, remaining === 0 ? index : index + 1];
    }
    remaining -= length;
  }
  return [editor, editor.childNodes.length];
}

export const CardRichEditor = forwardRef<CardEditorHandle, Props>(function CardRichEditor(
  { value, images, placeholder, label, disabled, onChange, onFiles, autoFocus, className },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [activeMath, setActiveMath] = useState<number | null>(null);
  const pendingCaret = useRef<number | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  useImperativeHandle(
    ref,
    () => ({
      get selectionStart() {
        return editorRef.current ? offsetIn(editorRef.current, false) : 0;
      },
      get selectionEnd() {
        return editorRef.current ? offsetIn(editorRef.current, true) : 0;
      },
      focus() {
        editorRef.current?.focus();
      },
      setSelectionRange(start, end) {
        const editor = editorRef.current;
        if (!editor) return;
        const range = document.createRange();
        const [startNode, startOffset] = locate(editor, start);
        const [endNode, endOffset] = locate(editor, end);
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      },
    }),
    [],
  );

  useEffect(() => {
    function updateSelection() {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection?.rangeCount || !editor.contains(selection.anchorNode)) {
        setActiveMath(null);
        return;
      }
      setActiveMath(
        activeMathAt(valueRef.current, offsetIn(editor, false), offsetIn(editor, true)),
      );
    }
    document.addEventListener("selectionchange", updateSelection);
    return () => document.removeEventListener("selectionchange", updateSelection);
  }, []);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const currentImages = Array.from(editor.querySelectorAll<HTMLImageElement>("img[data-id]"));
    const tokens = [...value.matchAll(tokenPattern)];
    const expectedImages = tokens.filter((token) => token[3] !== undefined);
    const expectedMath = tokens
      .filter(
        (token) => (token[4] !== undefined || token[5] !== undefined) && token.index !== activeMath,
      )
      .map((token) => String(token.index));
    const currentMath = Array.from(editor.querySelectorAll<HTMLElement>("[data-math-index]")).map(
      (node) => node.dataset.mathIndex,
    );
    if (
      serialize(editor) === value &&
      currentImages.length === expectedImages.length &&
      currentMath.join(",") === expectedMath.join(",") &&
      currentImages.every(
        (image) =>
          (image.getAttribute("src") ?? "") === (images[image.dataset.id ?? ""] ?? "") &&
          image.nextElementSibling instanceof HTMLButtonElement &&
          image.nextElementSibling.disabled === disabled,
      )
    )
      return;
    const focused = document.activeElement === editor;
    const start = focused ? offsetIn(editor, false) : 0;
    const end = focused ? offsetIn(editor, true) : 0;
    editor.replaceChildren();
    let last = 0;
    for (const match of tokens) {
      const isMath = match[4] !== undefined || match[5] !== undefined;
      if (match[3] === undefined && (!isMath || match.index === activeMath)) continue;
      editor.append(document.createTextNode(value.slice(last, match.index)));
      const wrapper = document.createElement("span");
      if (isMath) {
        try {
          wrapper.innerHTML = katex.renderToString(match[4] ?? match[5] ?? "", {
            displayMode: match[4] !== undefined,
            throwOnError: true,
            trust: false,
          });
        } catch {
          // Keep incomplete or invalid expressions editable as text.
          editor.append(document.createTextNode(match[0]));
          last = match.index + match[0].length;
          continue;
        }
        wrapper.className = `${styles.math}${match[4] !== undefined ? ` ${styles.mathBlock}` : ""}`;
        wrapper.contentEditable = "false";
        wrapper.dataset.markdown = match[0];
        wrapper.dataset.mathIndex = String(match.index);
        wrapper.addEventListener("click", () => {
          pendingCaret.current = match.index + match[0].length - (match[4] !== undefined ? 2 : 1);
          setActiveMath(match.index);
          editor.focus();
        });
        editor.append(wrapper);
        last = match.index + match[0].length;
        continue;
      }
      wrapper.className = styles.image;
      wrapper.contentEditable = "false";
      wrapper.dataset.markdown = match[0];
      const image = document.createElement("img");
      image.dataset.id = match[3];
      image.addEventListener("load", () => {
        // Match the wrapper to the displayed image even when its height, rather
        // than its width, is the limiting dimension (for example, a portrait).
        const width = Math.min(
          image.naturalWidth,
          320,
          (image.naturalWidth * 220) / image.naturalHeight,
        );
        if (Number.isFinite(width) && width > 0) wrapper.style.width = `${width}px`;
      });
      if (images[match[3]]) image.src = images[match[3]];
      image.alt = match[2] || "Image";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = styles.remove;
      remove.setAttribute("aria-label", `Remove ${image.alt}`);
      remove.textContent = "×";
      remove.disabled = disabled;
      remove.addEventListener("click", () => {
        wrapper.remove();
        changeRef.current(serialize(editor));
      });
      wrapper.append(image, remove);
      editor.append(wrapper);
      last = (match.index ?? 0) + match[0].length;
    }
    editor.append(document.createTextNode(value.slice(last)));
    if (focused) {
      const selection = window.getSelection();
      const range = document.createRange();
      const [startNode, startOffset] = locate(editor, pendingCaret.current ?? start);
      const [endNode, endOffset] = locate(editor, pendingCaret.current ?? end);
      pendingCaret.current = null;
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [value, images, disabled, activeMath]);

  return (
    <div
      ref={editorRef}
      className={`${styles.editor} ${className ?? ""}`}
      contentEditable={!disabled}
      suppressContentEditableWarning
      role="textbox"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-multiline="true"
      aria-disabled={disabled}
      data-placeholder={placeholder}
      data-modal-autofocus={autoFocus || undefined}
      onBlur={() => setActiveMath(null)}
      onInput={(event) => {
        const editor = event.currentTarget;
        const next = serialize(editor);
        setActiveMath(activeMathAt(next, offsetIn(editor, false), offsetIn(editor, true)));
        onChange(next);
      }}
      onPaste={(event) => {
        const files = Array.from(event.clipboardData.files).filter((file) =>
          file.type.startsWith("image/"),
        );
        event.preventDefault();
        if (files.length) onFiles(files);
        else document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        const files = Array.from(event.dataTransfer.files);
        if (files.length) {
          event.preventDefault();
          onFiles(files);
        }
      }}
    />
  );
});
