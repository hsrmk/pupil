import type { CardRecord, SpaceSummary } from "@pupil/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SpaceDetailsScreen } from "./SpaceDetailsScreen";

const space: SpaceSummary = {
  id: "space",
  name: "Science",
  cardCount: 2,
  dueTodayCount: 2,
  streak: 0,
  createdAt: 1,
  updatedAt: 1,
};
const card: CardRecord = {
  id: "one",
  spaceId: "space",
  spaceName: "Science",
  front: "Zebra",
  back: "Animal",
  tags: [],
  source: "manual",
  state: 0,
  due: 1,
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

describe("space card views", () => {
  it("switches between list and grid while retaining search and sort", async () => {
    const user = userEvent.setup();
    render(
      <SpaceDetailsScreen
        cards={[card, { ...card, id: "two", front: "Atom" }]}
        space={space}
        stats={null}
        isMutating={false}
        onBack={vi.fn()}
        onCreateCard={vi.fn()}
        onDeleteCard={vi.fn()}
        onDeleteSpace={vi.fn()}
        onOpenAiGenerate={vi.fn()}
        onOpenImport={vi.fn()}
        onRenameSpace={vi.fn()}
        onStartStudy={vi.fn()}
        onSuspendCard={vi.fn()}
        onUpdateCard={vi.fn()}
      />,
    );
    const switcher = screen.getByRole("group", { name: "Card view" });
    expect(within(switcher).getByRole("button", { name: "List view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(switcher).getByRole("button", { name: "Grid view" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort" }), "front");
    expect(
      screen
        .getAllByRole("button", { name: /^Open card:/ })
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Open card: Atom", "Open card: Zebra"]);
    const search = screen.getByPlaceholderText("Search this space by front, back, or tags...");
    await user.type(search, "zebra");
    expect(screen.getAllByRole("button", { name: /^Open card:/ })).toHaveLength(1);
    await user.click(within(switcher).getByRole("button", { name: "List view" }));
    expect(search).toHaveValue("zebra");
    expect(screen.getByRole("combobox", { name: "Sort" })).toHaveValue("front");
    expect(screen.getByRole("button", { name: /Zebra/ })).toBeInTheDocument();
  });
});
