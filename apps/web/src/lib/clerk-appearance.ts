/**
 * Shared appearance for Clerk's `<UserButton />`.
 *
 * Clerk renders the account trigger as a 28px avatar. That is the control which
 * opens sign-out, and 28px is well under the 44px minimum both mobile platforms
 * publish — on the header row it was the last control in the product below it.
 * Clerk owns the markup, so the size has to come through its own `appearance`
 * API; a stylesheet rule would be racing the styles Clerk injects at runtime.
 *
 * `userButtonTrigger` is the hit area and takes the 44px. `avatarBox` keeps the
 * avatar at the 32px the header row is designed around, so the control grows
 * without the avatar visibly changing size.
 *
 * One constant rather than three inline objects: the three surfaces that render
 * a UserButton (app header, onboarding, admin) had already drifted to two
 * different avatar sizes.
 */
export const USER_BUTTON_APPEARANCE = {
  elements: {
    userButtonTrigger: 'h-11 w-11 flex items-center justify-center rounded-full focus:shadow-none',
    avatarBox: 'h-8 w-8',
  },
} as const;
