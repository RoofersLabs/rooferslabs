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

/** 393 × 852 points — the Pro's panel. */
export const IPHONE = {
  screen: { width: 393, height: 852 },
  bezel: 10,
  edge: 2.5,
  radius: 56,
  screenRadius: 46,
  /** Status bar, and the strip the home indicator sits in. */
  statusBar: 44,
  homeIndicator: 20,
  island: { width: 122, height: 35, top: 11 },
} as const;

export type IphoneSpec = typeof IPHONE;

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
      <SideButton side="left" top={118} height={30} />
      <SideButton side="left" top={166} height={54} />
      <SideButton side="left" top={232} height={54} />
      <SideButton side="right" top={186} height={84} />

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
              bottom: 7,
              left: '50%',
              marginLeft: -67,
              width: 134,
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
