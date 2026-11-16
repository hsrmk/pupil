import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { SettingsScreen } from "./SettingsScreen";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

it("keeps general, data, and about settings without an AI provider tab", async () => {
  const user = userEvent.setup();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(
    <SettingsScreen
      cardsCount={2}
      spacesCount={1}
      studySettings={{ newCardsLimit: null, newCardsToday: 0 }}
      isSavingStudySettings={false}
      onResetAllData={vi.fn()}
      onSaveStudySettings={vi.fn()}
    />,
  );
  expect(screen.queryByRole("tab", { name: /AI/i })).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Data" }));
  expect(screen.getByText("Collection backup")).toBeInTheDocument();
  expect(screen.getByText("Review history")).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "About" }));
  expect(screen.getByText("MIT")).toBeInTheDocument();
});
