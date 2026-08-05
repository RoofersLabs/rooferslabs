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
 * Every measurement is in the device's own pixels at 1:1. `DeviceFrame` scales
 * the whole thing as one transform, so the bezel, the corner radii and the
 * shadow shrink together and the hardware never loses its proportions.
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

/** 2388 × 1668 device pixels — the 11" Pro's panel, in points, landscape. */
export const IPAD: IpadSpec = {
  screen: { width: 1024, height: 715 },
  bezel: 16,
  edge: 3,
  radius: 34,
  screenRadius: 18,
};

/** The same hardware at the logical width an iPad reports in portrait. */
export const IPAD_COMPACT: IpadSpec = {
  ...IPAD,
  screen: { width: 834, height: 582 },
  bezel: 14,
  radius: 30,
  screenRadius: 16,
};

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
