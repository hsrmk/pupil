import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CardFormPanel } from "./CardFormPanel";

function Editor() {
  const [draft, setDraft] = useState({
    front: "1=1 ",
    back: "Answer",
    spaceId: "",
    tagsText: "",
  });
  return (
    <CardFormPanel
      draft={draft}
      error={null}
      hasSelectedCard={false}
      isDeleting={false}
      isOpen
      isSubmitting={false}
      onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
      onClose={vi.fn()}
      onDelete={vi.fn()}
      onSubmit={vi.fn()}
      spaces={[]}
    />
  );
}

describe("card images", () => {
  it("imports an image into Pupil and renders its Markdown reference in the preview", async () => {
    render(<Editor />);
    const input = document.body.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2])], "sample.png", {
      type: "image/png",
    });
    fireEvent.change(input as HTMLInputElement, { target: { files: [png] } });
    await waitFor(() => expect(screen.getAllByAltText("sample")).toHaveLength(2));
    expect(screen.getAllByAltText("sample")[1].parentElement?.textContent).toContain("1=1");
    expect(screen.getByRole("textbox", { name: "Front" }).textContent).not.toContain(
      "pupil-image:",
    );
    expect(screen.getAllByAltText("sample")[0].getAttribute("src")).toMatch(
      /^data:image\/png;base64,/,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove sample" }));
    await waitFor(() => expect(screen.queryByAltText("sample")).toBeNull());
  });
});
