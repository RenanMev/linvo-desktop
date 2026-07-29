import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { Menu } from "@base-ui/react/menu";

import { cn } from "@/lib/utils";

type MenuHighlight = {
  height: number;
  opacity: number;
  top: number;
};

type DropdownMenuHighlightContextValue = {
  moveHighlight: (element: HTMLElement) => void;
  resetHighlight: () => void;
};

type DropdownMenuItemProps = ComponentProps<typeof Menu.Item>;

const DropdownMenuHighlightContext =
  createContext<DropdownMenuHighlightContextValue | null>(null);

function DropdownMenu({ ...props }: ComponentProps<typeof Menu.Root>) {
  return <Menu.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger({
  ...props
}: ComponentProps<typeof Menu.Trigger>) {
  return <Menu.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  children,
  align = "start",
  alignOffset,
  onMouseLeave,
  side,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof Menu.Popup> &
  Pick<
    ComponentProps<typeof Menu.Positioner>,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  const [highlight, setHighlight] = useState<MenuHighlight>({
    height: 0,
    opacity: 0,
    top: 0,
  });

  const moveHighlight = useCallback((element: HTMLElement) => {
    setHighlight({
      height: element.offsetHeight,
      opacity: 1,
      top: element.offsetTop,
    });
  }, []);

  const resetHighlight = useCallback(() => {
    setHighlight((current) => ({ ...current, opacity: 0 }));
  }, []);

  const highlightContext = useMemo(
    () => ({ moveHighlight, resetHighlight }),
    [moveHighlight, resetHighlight],
  );

  return (
    <Menu.Portal>
      <Menu.Positioner
        className="z-50"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <Menu.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "relative min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            "origin-[var(--transform-origin)] will-change-[opacity,transform]",
            "data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-97",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-97",
            className,
          )}
          onMouseLeave={(event) => {
            resetHighlight();
            onMouseLeave?.(event);
          }}
          {...props}
        >
          <DropdownMenuHighlightContext.Provider value={highlightContext}>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-1 right-1 rounded-sm bg-accent shadow-inner-light transition-[height,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
              style={{
                height: highlight.height,
                opacity: highlight.opacity,
                transform: `translateY(${highlight.top}px)`,
              }}
            />
            {children}
          </DropdownMenuHighlightContext.Provider>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: ComponentProps<"div"> & {
  inset?: boolean;
}) {
  return (
    <div
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-medium data-inset:pl-8",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Menu.Separator>) {
  return (
    <Menu.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  inset,
  onFocus,
  onPointerEnter,
  selected = false,
  variant = "default",
  ...props
}: DropdownMenuItemProps & {
  inset?: boolean;
  selected?: boolean;
  variant?: "default" | "destructive";
}) {
  const highlight = useContext(DropdownMenuHighlightContext);
  const itemRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selected && itemRef.current) {
      highlight?.moveHighlight(itemRef.current);
    }
  }, [highlight, selected]);

  function handlePointerEnter(
    event: Parameters<NonNullable<DropdownMenuItemProps["onPointerEnter"]>>[0],
  ) {
    highlight?.moveHighlight(event.currentTarget);
    onPointerEnter?.(event);
  }

  function handleFocus(
    event: Parameters<NonNullable<DropdownMenuItemProps["onFocus"]>>[0],
  ) {
    highlight?.moveHighlight(event.currentTarget);
    onFocus?.(event);
  }

  return (
    <Menu.Item
      ref={itemRef}
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-selected={selected}
      className={cn(
        "relative z-10 flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none transition-colors duration-200 ease-out",
        "data-highlighted:text-accent-foreground data-selected:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-300 data-highlighted:[&_svg]:scale-105 [&_svg:not([class*='size-'])]:size-4",
        variant === "destructive" &&
          "text-destructive data-highlighted:text-destructive",
        inset && "pl-8",
        className,
      )}
      onFocus={handleFocus}
      onPointerEnter={handlePointerEnter}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
