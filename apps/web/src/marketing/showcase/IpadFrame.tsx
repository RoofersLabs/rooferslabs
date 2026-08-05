import type { ReactNode } from 'react';

/**
 * An 11-inch iPad Pro, drawn in CSS.
 *
 * Three nested boxes and nothing else: a machined aluminium edge, the black
 * glass the display is set into, and the display. No images, no gloss sweep, no
 * frosted panel — the things that make a device mock-up look expensive are the
 * proportions and the shadow, and the things that make one look cheap are the
 * highlights someone added afterwards.
 *
 * Every measurement is in the device's own pixels at 1:1. `DeviceFrame` sizes
 * the display to the available width and does not transform the application
 * layer, so text stays at native browser resolution.
 */

export type IpadSpec = {
  screen: { width: number; height: number };
  /** Black glass between the display and the metal. */
  bezel: number;
  /** The aluminium rail itself. */
  edge: number;
  radius: number;
  screenRadius: number;
};

/** A 13-inch iPad Pro-style panel in landscape points, sized for readability. */
export const IPAD_SCREEN = { width: 1180, height: 824 } as const;

const ASPECT = IPAD_SCREEN.width / IPAD_SCREEN.height;

/**
 * The same hardware at whatever width the page can give it, in its own points.
 *
 * The showcase sizes the display to the space available rather than picking one
 * of two fixed panels and shrinking it: a tablet drawn at 0.83 renders the
 * product's 14px body text at 11.6px, which is the single largest reason the
 * interface was hard to read. Below a full-size iPad the screen simply *is*
 * fewer points across — the application lays out for a smaller tablet, exactly
 * as it would on one, and every glyph is at its native size.
 *
 * The bezel and the corner radii follow the panel, because a 16px bezel on a
 * 700pt screen is a chunky picture frame rather than an iPad.
 */
export function ipadSpecFor(screenWidth: number): IpadSpec {
  const width = Math.round(screenWidth);
  const t = Math.min(1, width / IPAD_SCREEN.width);
  return {
    screen: { width, height: Math.round(width / ASPECT) },
    bezel: Math.round(8 + 4 * t),
    edge: 2,
    radius: Math.round(22 + 10 * t),
    screenRadius: Math.round(11 + 6 * t),
  };
}

export function ipadOuter(spec: IpadSpec) {
  const inset = 2 * (spec.bezel + spec.edge);
  return { width: spec.screen.width + inset, height: spec.screen.height + inset };
}

/**
 * Anodised aluminium. A single linear gradient with the light running across
 * the short axis, so the top and bottom rails catch it and the sides fall away
 * — which is the whole of what makes a 3px border read as metal.
 */
const ALUMINIUM =
  'linear-gradient(168deg, #e6e8ea 0%, #9ea3a9 14%, #f2f4f5 32%, #8f959c 52%, #d6d9dc 72%, #82888f 88%, #c2c6ca 100%)';

export function IpadFrame({ spec, children }: { spec: IpadSpec; children: ReactNode }) {
  const outer = ipadOuter(spec);

  return (
    <div
      aria-hidden={false}
      style={{
        width: outer.width,
        height: outer.height,
        borderRadius: spec.radius,
        padding: spec.edge,
        background: ALUMINIUM,
        // One long, soft shadow plus the brand tint the marketing page already
        // lights its surfaces with. Nothing is cast sideways: the device is lit
        // from directly above, the way a product photograph is.
        boxShadow:
          '0 2px 3px rgba(255,255,255,0.18) inset, 0 50px 90px -50px rgba(0,0,0,0.9), 0 80px 160px -70px rgba(43,92,230,0.5)',
      }}
    >
      <div
        style={{
          height: '100%',
          borderRadius: spec.radius - spec.edge,
          padding: spec.bezel,
          background: '#080a0c',
          // The hairline where the glass meets the metal. It is the only
          // detail here that is not a plane, and it is what stops the bezel
          // reading as a black rectangle drawn on top of a grey one.
          boxShadow: '0 0 0 1px rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.06) inset',
          position: 'relative',
        }}
      >
        {/* Front camera, centred on the long edge as the current Pro has it. */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: spec.bezel / 2 - 2,
            left: '50%',
            marginLeft: -2.5,
            width: 5,
            height: 5,
            borderRadius: 999,
            background: 'radial-gradient(circle at 35% 35%, #2c3238 0%, #0d1114 70%)',
          }}
        />
        <div
          style={{
            width: spec.screen.width,
            height: spec.screen.height,
            borderRadius: spec.screenRadius,
            overflow: 'hidden',
            position: 'relative',
            background: '#fff',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
