import type { CardRecord } from "@pupil/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getStorage } from "../../lib/storage";
import { CardGrid } from "./CardGrid";

const card: CardRecord = {
  id: "card-a",
  spaceId: "space-a",
  spaceName: "Space A",
  front: "Why $x^2$?",
  back: "An answer",
  tags: ["math"],
  source: "manual",
  state: 0,
  due: 2_000_000_000_000,
  stability: 0,
  difficulty: 0,
  elapsedDays: 0,
  scheduledDays: 0,
  learningSteps: 0,
  reps: 0,
  lapses: 0,
  lastReview: null,
  createdAt: 1,
  updatedAt: 1,
  suspended: false,
  hasExplanation: false,
};

describe("card grid", () => {
  it("renders a stored image in the card front", async () => {
    const id = await getStorage().saveCardImage("iVBORw0KGgo=");
    render(
      <CardGrid
        cards={[{ ...card, front: `![diagram](pupil-image:${id})` }]}
        onDeleteCard={vi.fn()}
        onEditCard={vi.fn()}
        onSuspendCard={vi.fn()}
      />,
    );
    expect(await screen.findByAltText("diagram")).toHaveAttribute(
      "src",
      expect.stringMatching(/^data:image\/png;base64,/),
    );
  });
  it("shows card fronts and opens details with the back and edit action", async () => {
    const user = userEvent.setup();
    const edit = vi.fn();
    const { container } = render(
      <CardGrid cards={[card]} onDeleteCard={vi.fn()} onEditCard={edit} onSuspendCard={vi.fn()} />,
    );
    expect(container.querySelector(".katex")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Why/ }));
    const dialog = screen.getByRole("dialog", { name: "Card details" });
    expect(within(dialog).getByText("An answer")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));
    expect(edit).toHaveBeenCalledWith("card-a");
  });

  it("offers unsuspend for suspended cards", async () => {
    const user = userEvent.setup();
    const suspend = vi.fn();
    render(
      <CardGrid
        cards={[{ ...card, suspended: true }]}
        onDeleteCard={vi.fn()}
        onEditCard={vi.fn()}
        onSuspendCard={suspend}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Why/ }));
    await user.click(screen.getByRole("button", { name: "Unsuspend" }));
    expect(suspend).toHaveBeenCalledWith("card-a", false);
  });

  it("requires confirmation before deleting a card", async () => {
    const user = userEvent.setup();
    const remove = vi.fn();
    render(
      <CardGrid
        cards={[card]}
        onDeleteCard={remove}
        onEditCard={vi.fn()}
        onSuspendCard={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Open card:/ }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(remove).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Delete card?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete card" }));
    expect(remove).toHaveBeenCalledWith("card-a");
  });
});
