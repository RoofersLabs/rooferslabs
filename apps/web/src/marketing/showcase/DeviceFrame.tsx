import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { ScreenProvider } from '../dashboard/formFactor';
import { DeviceFloat } from './DeviceFloat';
import { IPAD, IPAD_COMPACT, IpadFrame, ipadOuter, type IpadSpec } from './IpadFrame';
import { IPHONE, IphoneFrame, StatusBar, iphoneOuter } from './IphoneFrame';

/**
 * The hardware the product runs on, sized to the space the page can give it.
 *
 * Two decisions are made here and nowhere else.
 *
 * **Which device.** Below `sm` the page shows an iPhone, because that is what a
 * visitor holding a phone is deciding whether to install. Above it, an iPad —
 * the same iPad at every width, scaled.
 *
 * **How big.** The device is drawn at 1:1 and scaled as a single transform, so
 * the bezel, the corner radii, the shadow and the application inside all shrink
 * together — the hardware keeps its proportions, and the application keeps
 * getting the screen it was designed for rather than a squeezed one. On a wide
 * desktop the scale lands on 1 and every pixel is native.
 *
 * That is also why the two iPad specs exist. A 1024pt screen scaled into a
 * 700px tablet column would put the product's 14px body type at 9px; the
 * compact spec renders the same hardware at the 834pt logical width an iPad
 * reports in portrait, so the application is still at an iPad's own size and
 * the type stays legible.
 */

const TILT_DEGREES = 5;

export type DeviceKind = 'ipad' | 'ipad-compact' | 'iphone';

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
  const phone = useMediaQuery('(max-width: 639px)');
  const compact = useMediaQuery('(max-width: 1023px)');
  if (phone) return 'iphone';
  return compact ? 'ipad-compact' : 'ipad';
}

function outerFor(kind: DeviceKind) {
  if (kind === 'iphone') return iphoneOuter(IPHONE);
  return ipadOuter(kind === 'ipad' ? IPAD : IPAD_COMPACT);
}

/**
 * Measures the column, picks a scale, and reserves the space the scaled device
 * will occupy so the page below it never moves.
 *
 * The height budget matters as much as the width: a 877pt phone at full width
 * would push the hero's copy off a laptop screen, so whichever of the two
 * constraints binds first wins.
 */
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
  const outer = outerFor(kind);
  const [scale, setScale] = useState(1);
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  // Layout effect, not effect: the device is drawn at 1:1 until it is measured,
  // and a full-size iPad painting for one frame inside a phone column is a jump
  // the visitor would see.
  useLayoutEffect(() => {
    if (!host) return;
    const measure = () =>
      setScale(
        Math.min(1, host.clientWidth / outer.width, (window.innerHeight * 0.86) / outer.height),
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [host, outer.width, outer.height]);

  return (
    <div ref={setHost} className="w-full">
      <DeviceFloat>
        <div
          className="relative mx-auto"
          style={{
            width: outer.width * scale,
            // The tilt brings the bottom edge towards the viewer, which makes
            // it project a little taller than the flat rectangle. The reserved
            // box allows for it so nothing below is overlapped.
            height: outer.height * scale * 1.02,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              width: outer.width,
              height: outer.height,
              marginLeft: -outer.width / 2,
              transformOrigin: 'top center',
              transform: `scale(${scale}) perspective(2600px) rotateX(${TILT_DEGREES}deg)`,
            }}
          >
            <Hardware kind={kind} screenRef={screenRef} overlay={overlay}>
              {children}
            </Hardware>
          </div>
        </div>
      </DeviceFloat>
    </div>
  );
}

function Hardware({
  kind,
  screenRef,
  overlay,
  children,
}: {
  kind: DeviceKind;
  screenRef: RefObject<HTMLDivElement>;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  if (kind === 'iphone') {
    return (
      <ScreenProvider width={IPHONE.screen.width}>
        <IphoneFrame spec={IPHONE}>
          <div ref={screenRef} className="relative flex h-full w-full flex-col bg-base">
            <StatusBar height={IPHONE.statusBar} islandWidth={IPHONE.island.width} />
            <div className="min-h-0 flex-1">{children}</div>
            {/* The strip the home indicator lives in, as a safe-area inset. */}
            <div className="shrink-0 bg-surface" style={{ height: IPHONE.homeIndicator }} />
            {overlay}
          </div>
        </IphoneFrame>
      </ScreenProvider>
    );
  }

  const spec: IpadSpec = kind === 'ipad' ? IPAD : IPAD_COMPACT;
  return (
    <ScreenProvider width={spec.screen.width}>
      <IpadFrame spec={spec}>
        <div ref={screenRef} className="relative h-full w-full">
          {children}
          {overlay}
        </div>
      </IpadFrame>
    </ScreenProvider>
  );
}
