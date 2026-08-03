import { render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";

import { useFocusTrap } from "@/hooks/use-focus-trap";

function TrapHarness({
  active,
  useInitialFocus = false,
  useReturnFocus = false,
}: {
  active: boolean;
  useInitialFocus?: boolean;
  useReturnFocus?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialRef = useRef<HTMLButtonElement>(null);
  const returnRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(containerRef, {
    active,
    initialFocusRef: useInitialFocus ? initialRef : undefined,
    returnFocusRef: useReturnFocus ? returnRef : undefined,
  });

  return (
    <div>
      <button type="button" ref={returnRef} data-testid="outside">
        outside
      </button>
      <div ref={containerRef} data-testid="container">
        <button type="button" data-testid="first">
          first
        </button>
        <button type="button" ref={initialRef} data-testid="second">
          second
        </button>
        <button type="button" data-testid="last">
          last
        </button>
      </div>
    </div>
  );
}

function fireTab(target: Element, shiftKey = false) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey,
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe("useFocusTrap", () => {
  it("focuses the first focusable element when activated", () => {
    render(<TrapHarness active />);
    expect(document.activeElement).toHaveAttribute("data-testid", "first");
  });

  it("focuses initialFocusRef when provided", () => {
    render(<TrapHarness active useInitialFocus />);
    expect(document.activeElement).toHaveAttribute("data-testid", "second");
  });

  it("wraps Tab from the last element back to the first", () => {
    render(<TrapHarness active />);
    const last = document.querySelector('[data-testid="last"]') as HTMLElement;
    last.focus();
    fireTab(last);
    expect(document.activeElement).toHaveAttribute("data-testid", "first");
  });

  it("wraps Shift+Tab from the first element back to the last", () => {
    render(<TrapHarness active />);
    const first = document.querySelector(
      '[data-testid="first"]',
    ) as HTMLElement;
    first.focus();
    fireTab(first, true);
    expect(document.activeElement).toHaveAttribute("data-testid", "last");
  });

  it("returns focus to returnFocusRef on deactivation", () => {
    const { rerender } = render(
      <TrapHarness active useReturnFocus />,
    );
    rerender(<TrapHarness active={false} useReturnFocus />);
    expect(document.activeElement).toHaveAttribute("data-testid", "outside");
  });
});
