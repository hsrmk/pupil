import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

it("reveals an already focused field when the viewport shrinks", () => {
  vi.useFakeTimers();
  const viewport = Object.assign(new EventTarget(), { height: 500, offsetTop: 0 });
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("innerWidth", 390);

  render(
    <Modal ariaLabel="Space" isOpen onClose={() => {}}>
      <input aria-label="Name" />
    </Modal>,
  );

  const panel = screen.getByRole("dialog", { name: "Space" });
  const field = screen.getByRole("textbox", { name: "Name" });
  vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 300 } as DOMRect);
  const fieldRect = vi.spyOn(field, "getBoundingClientRect");
  fieldRect.mockReturnValue({ top: 20, bottom: 60 } as DOMRect);
  act(() => {
    field.focus();
    vi.advanceTimersByTime(450);
  });
  expect(panel.scrollTop).toBe(0);

  fieldRect.mockReturnValue({ top: 400, bottom: 450 } as DOMRect);
  act(() => {
    viewport.height = 180;
    viewport.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(450);
  });
  expect(panel.scrollTop).toBe(384);
});

it("keeps keyboard focus inside the dialog when a control is hidden", () => {
  render(
    <Modal ariaLabel="Editor" isOpen onClose={() => {}}>
      <button style={{ display: "none" }} type="button">
        Hidden
      </button>
      <button type="button">First</button>
      <button type="button">Last</button>
    </Modal>,
  );
  const first = screen.getByRole("button", { name: "First" });
  const last = screen.getByRole("button", { name: "Last" });
  first.focus();
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(last).toHaveFocus();
});
