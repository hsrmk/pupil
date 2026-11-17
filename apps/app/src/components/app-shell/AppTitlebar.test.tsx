import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AppTab, AppTitlebar } from "./AppTitlebar";

const tabs: AppTab[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "cards", label: "All Cards" },
  { id: "import", label: "Import" },
  { id: "settings", label: "Settings" },
];

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

describe("AppTitlebar navigation", () => {
  it("opens and dismisses the create menu", async () => {
    const user = userEvent.setup();
    render(
      <AppTitlebar
        activeTab="dashboard"
        onOpenCreateDialog={vi.fn()}
        onOpenNewCard={vi.fn()}
        onOpenPalette={vi.fn()}
        onSelectTab={vi.fn()}
        tabs={tabs}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Create" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("exposes each tab by name and marks the current page", async () => {
    const user = userEvent.setup();
    const onSelectTab = vi.fn();
    render(
      <AppTitlebar
        activeTab="dashboard"
        onOpenCreateDialog={vi.fn()}
        onOpenPalette={vi.fn()}
        onSelectTab={onSelectTab}
        tabs={tabs}
      />,
    );

    expect(screen.getByRole("button", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const [name, id] of [
      ["All Cards", "cards"],
      ["Import", "import"],
      ["Settings", "settings"],
    ] as const) {
      await user.click(screen.getByRole("button", { name }));
      expect(onSelectTab).toHaveBeenLastCalledWith(id);
    }
  });

  it("keeps search and the two creation actions independent", async () => {
    const user = userEvent.setup();
    const onOpenNewCard = vi.fn();
    const onOpenCreateDialog = vi.fn();
    const onOpenPalette = vi.fn();
    render(
      <AppTitlebar
        activeTab="dashboard"
        globalStreak={2}
        onOpenNewCard={onOpenNewCard}
        onOpenCreateDialog={onOpenCreateDialog}
        onOpenPalette={onOpenPalette}
        onSelectTab={vi.fn()}
        tabs={tabs}
      />,
    );

    expect(screen.getByText("2 day streak")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New Card" }));
    await user.click(screen.getByRole("button", { name: "New Space" }));
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(onOpenNewCard).toHaveBeenCalledOnce();
    expect(onOpenCreateDialog).toHaveBeenCalledOnce();
    expect(onOpenPalette).toHaveBeenCalledOnce();
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AppTitlebar update prompt", () => {
  it("installs from the header Update button", async () => {
    const user = userEvent.setup();
    const onInstallUpdate = vi.fn();

    render(
      <AppTitlebar
        activeTab="dashboard"
        onInstallUpdate={onInstallUpdate}
        onOpenCreateDialog={vi.fn()}
        onOpenPalette={vi.fn()}
        onSelectTab={vi.fn()}
        tabs={[]}
        updateActionLabel="Update"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Update" }));
    expect(onInstallUpdate).toHaveBeenCalledOnce();
  });
});
