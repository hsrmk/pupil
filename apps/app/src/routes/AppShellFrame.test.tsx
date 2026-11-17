import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppTab } from "../components/app-shell/AppTitlebar";
import { useAppUpdateStore } from "../lib/app-update-store";
import { AppShellFrame } from "./AppShellFrame";

const tabs: AppTab[] = [{ id: "dashboard", label: "Dashboard" }];
const props = {
  activeTab: null,
  globalStreak: 0,
  onOpenCommandPalette: vi.fn(),
  onOpenCreateDialog: vi.fn(),
  onSelectTab: vi.fn(),
  tabs,
};

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  useAppUpdateStore.setState({ refresh: vi.fn(async () => {}) });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("study navigation", () => {
  it.each(["/study", "/spaces/biology/study"])(
    "does not render the main navigation during %s",
    (pathname) => {
      render(
        <AppShellFrame {...props} pathname={pathname}>
          <div>Review</div>
        </AppShellFrame>,
      );
      expect(screen.getByText("Review")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Dashboard" })).not.toBeInTheDocument();
    },
  );

  it("keeps space navigation available on the space page", () => {
    render(
      <AppShellFrame {...props} pathname="/spaces/biology">
        <div>Space</div>
      </AppShellFrame>,
    );
    expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
  });
});
