import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps a mobile dialog within the visible viewport as the keyboard opens", () => {
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("innerWidth", 390);

  render(
    <Modal ariaLabel="Test dialog" isOpen onClose={() => {}}>
      <button type="button">Done</button>
    </Modal>,
  );

  const overlay = screen.getByRole("dialog", { name: "Test dialog" }).parentElement;
  expect(overlay).toHaveStyle({ height: "800px", top: "0px" });

  viewport.height = 360;
  viewport.offsetTop = 20;
  viewport.dispatchEvent(new Event("resize"));
  expect(overlay).toHaveStyle({ height: "360px", top: "20px" });

  vi.stubGlobal("innerWidth", 1024);
  window.dispatchEvent(new Event("resize"));
  expect(overlay?.style.height).toBe("");
  expect(overlay?.style.top).toBe("");
});
