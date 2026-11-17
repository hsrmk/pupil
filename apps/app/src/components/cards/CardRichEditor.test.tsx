import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { type CardEditorHandle, CardRichEditor } from "./CardRichEditor";

function Editor({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <CardRichEditor
      value={value}
      images={{ abc: "data:image/png;base64,AAAA" }}
      label="Front"
      placeholder="Write"
      disabled={false}
      onChange={setValue}
      onFiles={vi.fn()}
    />
  );
}

describe("inline card editor", () => {
  it("disables iOS autocorrection for technical card content", () => {
    const originalPlatform = document.documentElement.dataset.platform;
    document.documentElement.dataset.platform = "ios";
    try {
      render(<Editor initial="" />);
      expect(screen.getByRole("textbox", { name: "Front" })).toHaveAttribute("autocorrect", "off");
    } finally {
      if (originalPlatform === undefined) delete document.documentElement.dataset.platform;
      else document.documentElement.dataset.platform = originalPlatform;
    }
  });

  it.each(["ArrowLeft", "ArrowRight"])("opens an adjacent rendered equation with %s", (key) => {
    const ref = createRef<CardEditorHandle>();
    const value = "A $x^2$ B";
    render(
      <CardRichEditor
        ref={ref}
        value={value}
        images={{}}
        label="Front"
        placeholder="Write"
        disabled={false}
        onChange={vi.fn()}
        onFiles={vi.fn()}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Front" });
    act(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(key === "ArrowLeft" ? 7 : 2, key === "ArrowLeft" ? 7 : 2);
    });
    fireEvent.keyDown(editor, { key });
    expect(editor.textContent).toContain("$x^2$");
    expect(editor.querySelector("[data-math-index]")).toBeNull();
    expect(ref.current?.selectionStart).toBe(key === "ArrowLeft" ? 6 : 3);
  });
  it("renders inline and block math, reveals the source for editing, and renders it again when the caret leaves", () => {
    const ref = createRef<CardEditorHandle>();
    const value = "Before $x^2$ after $$\\frac{1}{2}$$ end";
    render(
      <CardRichEditor
        ref={ref}
        value={value}
        images={{}}
        label="Front"
        placeholder="Write"
        disabled={false}
        onChange={vi.fn()}
        onFiles={vi.fn()}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Front" });
    expect(editor.querySelectorAll("[data-math-index]")).toHaveLength(2);
    fireEvent.click(editor.querySelector("[data-math-index]") as HTMLElement);
    expect(editor.textContent).toContain("$x^2$");
    expect(editor.querySelectorAll("[data-math-index]")).toHaveLength(1);
    act(() => {
      ref.current?.setSelectionRange(value.length, value.length);
      document.dispatchEvent(new Event("selectionchange"));
    });
    expect(editor.querySelectorAll("[data-math-index]")).toHaveLength(2);
    expect(editor.textContent).not.toContain("$x^2$");
  });

  it("leaves invalid equations and math in code as editable text", () => {
    render(<Editor initial={"`$x$` and $\\notacommand$"} />);
    const editor = screen.getByRole("textbox", { name: "Front" });
    expect(editor.textContent).toContain("`$x$` and $\\notacommand$");
    expect(editor.querySelector("[data-math-index]")).toBeNull();
  });

  it("renders an equation when the editor loses focus", () => {
    render(<Editor initial="A $x$ B" />);
    const editor = screen.getByRole("textbox", { name: "Front" });
    fireEvent.click(editor.querySelector("[data-math-index]") as HTMLElement);
    expect(editor.textContent).toContain("$x$");
    fireEvent.blur(editor);
    expect(editor.querySelector("[data-math-index]")).not.toBeNull();
  });

  it("does not mistake a partially typed display equation for inline math", async () => {
    const user = userEvent.setup();
    render(<Editor initial="" />);
    const editor = screen.getByRole("textbox", { name: "Front" });
    await user.click(editor);
    await user.type(editor, "$$x$");
    expect(editor.textContent).toBe("$$x$");
    expect(editor.querySelector("[data-math-index]")).toBeNull();
    await user.type(editor, "$ ");
    expect(editor.querySelector(".katex-display")).not.toBeNull();
  });
  it("shows stored images in place and removes only the selected image", () => {
    render(
      <Editor initial="Before ![one](pupil-image:abc) middle ![two](pupil-image:abc) after" />,
    );
    expect(screen.getByRole("textbox").textContent).not.toContain("pupil-image");
    fireEvent.click(screen.getByRole("button", { name: "Remove one" }));
    expect(screen.queryByAltText("one")).toBeNull();
    expect(screen.getByAltText("two")).toBeTruthy();
    expect(screen.getByRole("textbox").textContent).toContain("Before  middle");
  });

  it("keeps the remove control on the corner of a height-limited portrait", () => {
    render(<Editor initial="![portrait](pupil-image:abc)" />);
    const image = screen.getByAltText("portrait");
    Object.defineProperties(image, { naturalWidth: { value: 400 }, naturalHeight: { value: 800 } });
    fireEvent.load(image);
    expect(image.parentElement?.style.width).toBe("110px");
    expect(screen.getByRole("button", { name: "Remove portrait" }).parentElement).toBe(
      image.parentElement,
    );
  });

  it("tracks cursor positions around an embedded image for formatting and insertion", () => {
    const ref = createRef<CardEditorHandle>();
    render(
      <CardRichEditor
        ref={ref}
        value="a![x](pupil-image:abc)b"
        images={{ abc: "data:image/png;base64,AAAA" }}
        label="Front"
        placeholder="Write"
        disabled={false}
        onChange={vi.fn()}
        onFiles={vi.fn()}
      />,
    );
    ref.current?.focus();
    ref.current?.setSelectionRange(0, 1);
    expect(ref.current?.selectionStart).toBe(0);
    expect(ref.current?.selectionEnd).toBe(1);
    ref.current?.setSelectionRange(22, 22);
    expect(ref.current?.selectionStart).toBe(22);
  });

  it("imports files from paste and drop events", () => {
    const onFiles = vi.fn();
    render(
      <CardRichEditor
        value=""
        images={{}}
        label="Front"
        placeholder="Write"
        disabled={false}
        onChange={vi.fn()}
        onFiles={onFiles}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Front" });
    const file = new File(["image"], "image.png", { type: "image/png" });
    fireEvent.paste(editor, { clipboardData: { files: [file] } });
    fireEvent.drop(editor, { dataTransfer: { files: [file] } });
    expect(onFiles).toHaveBeenCalledTimes(2);
    expect(onFiles).toHaveBeenCalledWith([file]);
  });
});
