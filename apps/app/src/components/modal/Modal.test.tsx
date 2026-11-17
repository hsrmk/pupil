import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("scrolls a focused mobile field into the dialog after the keyboard appears", () => {
  vi.useFakeTimers();
  vi.stubGlobal("innerWidth", 390);

  render(
    <Modal ariaLabel="Editor" isOpen onClose={() => {}}>
      <input aria-label="Back" />
    </Modal>,
  );

  const panel = screen.getByRole("dialog", { name: "Editor" });
  const field = screen.getByRole("textbox", { name: "Back" });
  vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 300 } as DOMRect);
  vi.spyOn(field, "getBoundingClientRect").mockReturnValue({ top: 500, bottom: 600 } as DOMRect);

  act(() => {
    field.focus();
    vi.advanceTimersByTime(450);
  });
  expect(panel.scrollTop).toBe(484);
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

it("uses the phone viewport for a short landscape touchscreen", () => {
  const viewport = Object.assign(new EventTarget(), { height: 220, offsetTop: 0 });
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("innerWidth", 844);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));

  render(
    <Modal ariaLabel="Landscape dialog" isOpen onClose={() => {}}>
      <button type="button">Done</button>
    </Modal>,
  );

  const overlay = screen.getByRole("dialog", { name: "Landscape dialog" }).parentElement;
  expect(overlay).toHaveStyle({ height: "220px" });
});
