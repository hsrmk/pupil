import { fireEvent, render, screen } from "@testing-library/react";
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
