import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { SpaceDetailsTitlebar } from "./SpaceDetailsTitlebar";

afterEach(cleanup);

it("keeps space navigation and creation actions independent", async () => {
  const user = userEvent.setup();
  const onBack = vi.fn();
  const onOpenNewCard = vi.fn();
  const onOpenImport = vi.fn();
  render(
    <SpaceDetailsTitlebar
      spaceName="Biology"
      onBack={onBack}
      onOpenNewCard={onOpenNewCard}
      onOpenImport={onOpenImport}
      onOpenDeleteDialog={vi.fn()}
      onOpenRenameDialog={vi.fn()}
    />,
  );

  expect(screen.getByText("Biology")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Dashboard" }));
  await user.click(screen.getByRole("button", { name: "New Card" }));
  await user.click(screen.getByRole("button", { name: "Import" }));
  expect(onBack).toHaveBeenCalledOnce();
  expect(onOpenNewCard).toHaveBeenCalledOnce();
  expect(onOpenImport).toHaveBeenCalledOnce();
});
