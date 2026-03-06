# App Shell Layout Design

## Problem

Layout uses `min-h-screen` with no height constraint flowing to children. Full-height pages (TimerView, StartTimerModal) can't fill the viewport — content overflows past the screen bottom.

## Design

App shell pattern: viewport-locked outer div, fixed header/tabs, bounded scrollable content area.

### Layout structure

```
div (h-dvh, flex col)
  div (max-w-md, flex col, flex-1, min-h-0)
    header (px-4, fixed size)
    TabNav (px-4, fixed size)
    main (flex-1, min-h-0, overflow-auto, flex col, px-4, pb-safe-area)
      {children}
```

- `h-dvh` locks outer to viewport
- `flex col` + `min-h-0` at each level passes height constraint down
- `<main>` is the scroll container — header/tabs never scroll away
- `px-4` on individual sections instead of wrapper
- Safe area inset on `<main>` bottom

### FullHeight component

Reusable opt-in for pages that fill the content area:

```tsx
function FullHeight({ children, className }) {
  return <div className={cn("flex-1 flex flex-col min-h-0", className)}>{children}</div>
}
```

### Consumers

- **TimerView** — `<FullHeight>` wrapper, internal flex layout unchanged
- **StartTimerModal** — `<FullHeight className="items-center justify-center">` for both modes
- **Scrollable pages** (Dashboard, Sessions, Rankings) — no changes needed
