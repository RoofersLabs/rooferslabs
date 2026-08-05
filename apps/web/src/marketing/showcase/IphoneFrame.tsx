import type { ReactNode } from 'react';

/**
 * An iPhone Pro, drawn in CSS.
 *
 * Same construction as the iPad — titanium rail, black glass, display — with
 * the two details a phone is recognised by: the Dynamic Island and the home
 * indicator. Both are drawn as hardware, over the application rather than
 * inside it, and the screen reserves the space they occupy exactly as
 * `env(safe-area-inset-*)` does on the real thing. The application is not
 * asked to know it is in a phone.
 */

export type IphoneSpec = {
  screen: { width: number; height: number };
  bezel: number;
  edge: number;
  radius: number;
  screenRadius: number;
  /** Status bar, and the strip the home indicator sits in. */
  statusBar: number;
  homeIndicator: number;
  island: { width: number; height: number; top: number };
  buttons: { top: number; height: number; side: 'left' | 'right' }[];
};

/** 393 × 852 points — the Pro's panel, and the reference every part scales from. */
export const IPHONE_SCREEN = { width: 393, height: 852 } as const;

/**
 * The same handset at whatever width the page can give it.
 *
 * A 390px-wide browser cannot show a 393pt phone at 1:1 *and* the metal around
 * it, so the old fixed panel was scaled to 0.83 and every glyph inside it came
 * out a sixth smaller than the application draws it. Narrowing the panel a few
 * points instead keeps the display at its native size: the product renders at
 * 341pt the way it renders on a small phone, and the type is the type.
 */
export function iphoneSpecFor(screenWidth: number): IphoneSpec {
  const width = Math.round(screenWidth);
  const k = width / IPHONE_SCREEN.width;
  const round = (value: number) => Math.round(value * k);
  return {
    screen: { width, height: round(IPHONE_SCREEN.height) },
    bezel: Math.max(6, round(8)),
    edge: 2.5,
    radius: round(52),
    screenRadius: round(43),
    statusBar: Math.max(36, round(42)),
    homeIndicator: Math.max(14, round(18)),
    island: { width: round(118), height: Math.max(28, round(33)), top: round(10) },
    buttons: [
      { side: 'left', top: round(118), height: round(30) },
      { side: 'left', top: round(166), height: round(54) },
      { side: 'left', top: round(232), height: round(54) },
      { side: 'right', top: round(186), height: round(84) },
    ],
  };
}

export function iphoneOuter(spec: IphoneSpec) {
  const inset = 2 * (spec.bezel + spec.edge);
  return { width: spec.screen.width + inset, height: spec.screen.height + inset };
}

/** Brushed titanium: cooler and darker than the iPad's aluminium. */
const TITANIUM =
  'linear-gradient(155deg, #b6babd 0%, #6a6e73 16%, #d3d6d9 34%, #5c6065 56%, #a9aeb2 74%, #55595e 90%, #9aa0a5 100%)';

/** A side button: a sliver of the same metal, standing 2px proud of the rail. */
function SideButton({
  side,
  top,
  height,
}: {
  side: 'left' | 'right';
  top: number;
  height: number;
}) {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top,
        height,
        width: 2.5,
        left: side === 'left' ? -2.5 : undefined,
        right: side === 'right' ? -2.5 : undefined,
        background: TITANIUM,
        borderRadius: side === 'left' ? '2px 0 0 2px' : '0 2px 2px 0',
      }}
    />
  );
}

export function IphoneFrame({ spec, children }: { spec: IphoneSpec; children: ReactNode }) {
  const outer = iphoneOuter(spec);

  return (
    <div
      style={{
        position: 'relative',
        width: outer.width,
        height: outer.height,
        borderRadius: spec.radius,
        padding: spec.edge,
        background: TITANIUM,
        boxShadow:
          '0 1px 2px rgba(255,255,255,0.2) inset, 0 40px 70px -40px rgba(0,0,0,0.9), 0 60px 120px -60px rgba(43,92,230,0.5)',
      }}
    >
      {spec.buttons.map((button) => (
        <SideButton
          key={`${button.side}-${button.top}`}
          side={button.side}
          top={button.top}
          height={button.height}
        />
      ))}

      <div
        style={{
          height: '100%',
          borderRadius: spec.radius - spec.edge,
          padding: spec.bezel,
          background: '#08090b',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.06) inset',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: spec.screen.width,
            height: spec.screen.height,
            borderRadius: spec.screenRadius,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          {children}

          {/* Hardware, so it sits above the application and is never scrolled
              by it. The screen below reserves its height rather than sliding
              under it — a Dynamic Island covering a header is a mock-up
              mistake, not a device one. */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: spec.island.top,
              left: '50%',
              marginLeft: -spec.island.width / 2,
              width: spec.island.width,
              height: spec.island.height,
              borderRadius: 999,
              background: '#000',
            }}
          >
            <span
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                marginTop: -4.5,
                width: 9,
                height: 9,
                borderRadius: 999,
                background: 'radial-gradient(circle at 35% 35%, #1d2429 0%, #05070a 70%)',
              }}
            />
          </span>

          <span
            aria-hidden
            style={{
              position: 'absolute',
              bottom: Math.round(spec.homeIndicator * 0.35),
              left: '50%',
              marginLeft: -spec.screen.width * 0.17,
              width: spec.screen.width * 0.34,
              height: 5,
              borderRadius: 999,
              background: 'rgba(10,12,16,0.32)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The iOS status bar, rendered inside the screen above the application.
 *
 * A PWA on a phone gets exactly this: the system bar in the app's own colour,
 * then the app. Drawing it is what makes the difference between "the website in
 * a phone-shaped box" and "the app, installed".
 */
export function StatusBar({ height, islandWidth }: { height: number; islandWidth: number }) {
  return (
    <div
      aria-hidden
      className="relative z-10 flex shrink-0 items-center justify-between bg-surface px-7 text-ink"
      style={{ height }}
    >
      <span className="font-num text-[13px] font-semibold tracking-tight">9:41</span>
      <span style={{ width: islandWidth }} />
      <span className="flex items-center gap-1.5">
        {/* Cellular bars, wifi, battery — five small shapes, no icon font. */}
        <span className="flex items-end gap-[2px]">
          {[4, 6, 8, 10].map((bar) => (
            <span
              key={bar}
              className="w-[3px] rounded-[1px] bg-ink"
              style={{ height: bar, opacity: bar === 10 ? 0.35 : 1 }}
            />
          ))}
        </span>
        <span
          className="ml-0.5 h-[11px] w-[15px] bg-ink"
          style={{ clipPath: 'polygon(50% 100%, 0% 26%, 22% 8%, 50% 0%, 78% 8%, 100% 26%)' }}
        />
        <span className="relative ml-0.5 flex h-[11px] w-[23px] items-center rounded-[3px] border border-ink/40 px-[1.5px]">
          <span className="h-[7px] w-[14px] rounded-[1.5px] bg-ink" />
          <span className="absolute -right-[3px] h-[4px] w-[1.5px] rounded-r-[1px] bg-ink/40" />
        </span>
      </span>
    </div>
  );
}
