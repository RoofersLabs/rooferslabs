import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { ScreenProvider } from '../dashboard/formFactor';
import { IPAD_SCREEN, IpadFrame, ipadOuter, ipadSpecFor, type IpadSpec } from './IpadFrame';
import {
  IPHONE_SCREEN,
  IphoneFrame,
  StatusBar,
  iphoneOuter,
  iphoneSpecFor,
  type IphoneSpec,
} from './IphoneFrame';

/**
 * The hardware the product runs on, sized to the space the page can give it.
 *
 * Two decisions are made here and nowhere else.
 *
 * **Which device.** Below `md` the page shows an iPhone, because that is what a
 * visitor holding a phone is deciding whether to install. Above it, an iPad.
 *
 * **How big.** The application is never drawn below 1:1. That is the whole
 * rule, and it replaces the two fixed panels this used to scale down into the
 * column: a 1024pt iPad squeezed into a 720px tablet column rendered the
 * product's 14px body text at 11.6px, and the 393pt phone came out at the same
 * 0.83. The panel is sized in *its own points* to the space available instead,
 * so a narrower column means a smaller tablet — the application lays out for
 * one, exactly as it would on one — and every glyph is at its native size.
 *
 * The old height budget (86% of the window) is deliberately gone. It was the
 * reason a 1366×768 laptop — an ordinary laptop — saw the interface at 0.88,
 * and the hero's copy already decides where the device starts. Height is
 * allowed to run past the fold; legibility is not negotiable, and the visitor
 * scrolls a hero either way.
 */

/**
 * The narrowest each panel is allowed to get, in its own points. Both are real
 * devices — an iPhone SE and a small Android tablet — so the application is
 * never asked to lay out for a width no hardware has.
 */
const MIN_PHONE = 320;
const MIN_TABLET = 640;

export type DeviceKind = 'ipad' | 'iphone';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}

/** Which device the page is showing, and therefore which layout the app renders. */
export function useDeviceKind(): DeviceKind {
  return useMediaQuery('(max-width: 767px)') ? 'iphone' : 'ipad';
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type Box = { width: number; height: number };

type Fitted =
  | { kind: 'iphone'; spec: IphoneSpec; outer: Box }
  | { kind: 'ipad'; spec: IpadSpec; outer: Box };

function fitScreenWidth<Spec extends { screen: { width: number } }>(
  available: number,
  preferredMin: number,
  maxWidth: number,
  makeSpec: (width: number) => Spec,
  makeOuter: (spec: Spec) => Box,
  estimatedInset: number,
): Spec {
  const usable = Math.max(1, available - estimatedInset);
  let width = clamp(usable, Math.min(preferredMin, usable), maxWidth);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const spec = makeSpec(width);
    const outer = makeOuter(spec);
    if (outer.width <= available || width <= 1) return spec;
    width = Math.max(1, width - Math.ceil(outer.width - available));
  }

  return makeSpec(width);
}

/**
 * The panel and the scale for a given column width.
 *
 * Sizing the screen first and scaling second is what keeps the application at
 * 1:1 or better: the points come out of the space, rather than the space being
 * asked to hold a fixed number of points.
 */
function fit(kind: DeviceKind, available: number): Fitted {
  if (kind === 'iphone') {
    const inset = 2 * (iphoneSpecFor(IPHONE_SCREEN.width).bezel + 2.5);
    const spec = fitScreenWidth(
      available,
      MIN_PHONE,
      IPHONE_SCREEN.width,
      iphoneSpecFor,
      iphoneOuter,
      inset,
    );
    const outer = iphoneOuter(spec);
    return { kind, spec, outer };
  }

  const inset = 2 * (ipadSpecFor(IPAD_SCREEN.width).bezel + 3);
  const spec = fitScreenWidth(
    available,
    MIN_TABLET,
    IPAD_SCREEN.width,
    ipadSpecFor,
    ipadOuter,
    inset,
  );
  const outer = ipadOuter(spec);
  return { kind, spec, outer };
}

export function DeviceFrame({
  kind,
  screenRef,
  overlay,
  children,
}: {
  kind: DeviceKind;
  /** The display's own element — the showcase measures cursor targets against it. */
  screenRef: RefObject<HTMLDivElement>;
  /** Cursor and taps: drawn on the glass, above the application, never in it. */
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState(0);

  // Layout effect, not effect: the device is unsized until it is measured, and
  // a full-size iPad painting for one frame inside a phone column is a jump the
  // visitor would see.
  useLayoutEffect(() => {
    if (!host) return;
    const measure = () => setAvailable(host.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [host]);

  const fitted = fit(kind, available || IPAD_SCREEN.width);
  const { outer } = fitted;

  return (
    <div ref={setHost} className="w-full">
      {available > 0 && (
        <div className="relative mx-auto" style={{ width: outer.width, height: outer.height }}>
          <Hardware fitted={fitted} screenRef={screenRef} overlay={overlay}>
            {children}
          </Hardware>
        </div>
      )}
    </div>
  );
}

function Hardware({
  fitted,
  screenRef,
  overlay,
  children,
}: {
  fitted: Fitted;
  screenRef: RefObject<HTMLDivElement>;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  if (fitted.kind === 'iphone') {
    const phone = fitted.spec;
    return (
      <ScreenProvider width={phone.screen.width}>
        <IphoneFrame spec={phone}>
          <div ref={screenRef} className="relative flex h-full w-full flex-col bg-base">
            <StatusBar height={phone.statusBar} islandWidth={phone.island.width} />
            <div className="min-h-0 flex-1">{children}</div>
            {/* The strip the home indicator lives in, as a safe-area inset. */}
            <div className="shrink-0 bg-surface" style={{ height: phone.homeIndicator }} />
            {overlay}
          </div>
        </IphoneFrame>
      </ScreenProvider>
    );
  }

  return (
    <ScreenProvider width={fitted.spec.screen.width}>
      <IpadFrame spec={fitted.spec}>
        <div ref={screenRef} className="relative h-full w-full">
          {children}
          {overlay}
        </div>
      </IpadFrame>
    </ScreenProvider>
  );
}
