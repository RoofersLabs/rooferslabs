import { isInternalUser, parseInternalUsers, resolveLaunchMode } from './launch.flag';

describe('resolveLaunchMode', () => {
  it('is public everywhere that is not production, whatever the flag says', () => {
    // Local development must never be gated: a developer should not have to add
    // themselves to an allowlist to run the app they are building.
    expect(resolveLaunchMode({ APP_LAUNCH_MODE: 'private' } as NodeJS.ProcessEnv)).toBe('public');
    expect(
      resolveLaunchMode({
        APP_ENV: 'development',
        APP_LAUNCH_MODE: 'private',
      } as NodeJS.ProcessEnv),
    ).toBe('public');
  });

  it('reads APP_ENV, not NODE_ENV', () => {
    // NODE_ENV is "production" in every deployed environment including a future
    // devstage; only the tier decides whether the gate applies.
    expect(
      resolveLaunchMode({
        NODE_ENV: 'production',
        APP_LAUNCH_MODE: 'private',
      } as NodeJS.ProcessEnv),
    ).toBe('public');
  });

  it('honours an explicit public in production — this is the launch-day switch', () => {
    expect(
      resolveLaunchMode({ APP_ENV: 'production', APP_LAUNCH_MODE: 'public' } as NodeJS.ProcessEnv),
    ).toBe('public');
  });

  it('fails CLOSED in production for anything that is not exactly "public"', () => {
    const cases = [undefined, '', 'private', 'PUBLIC', 'Public', 'true', 'open', 'yes'];
    for (const value of cases) {
      expect(
        resolveLaunchMode({ APP_ENV: 'production', APP_LAUNCH_MODE: value } as NodeJS.ProcessEnv),
      ).toBe('private');
    }
  });
});

describe('parseInternalUsers', () => {
  it('parses, trims, lowercases, and de-duplicates', () => {
    expect(
      parseInternalUsers({
        INTERNAL_USERS: ' Founder@RoofersLabs.com , ops@rooferslabs.com,founder@rooferslabs.com ',
      } as NodeJS.ProcessEnv),
    ).toEqual(['founder@rooferslabs.com', 'ops@rooferslabs.com']);
  });

  it('is empty when unset or blank', () => {
    expect(parseInternalUsers({} as NodeJS.ProcessEnv)).toEqual([]);
    expect(parseInternalUsers({ INTERNAL_USERS: '   ' } as NodeJS.ProcessEnv)).toEqual([]);
    expect(parseInternalUsers({ INTERNAL_USERS: ',,,' } as NodeJS.ProcessEnv)).toEqual([]);
  });

  it('discards entries that are not addresses rather than keeping unmatchable values', () => {
    expect(
      parseInternalUsers({
        INTERNAL_USERS: 'founder@rooferslabs.com,nonsense',
      } as NodeJS.ProcessEnv),
    ).toEqual(['founder@rooferslabs.com']);
  });
});

describe('isInternalUser', () => {
  const allowlist = ['founder@rooferslabs.com'];

  it('matches case-insensitively and ignores surrounding space', () => {
    expect(isInternalUser('founder@rooferslabs.com', allowlist)).toBe(true);
    expect(isInternalUser('Founder@RoofersLabs.com', allowlist)).toBe(true);
    expect(isInternalUser('  founder@rooferslabs.com  ', allowlist)).toBe(true);
  });

  it('rejects anyone not on the list', () => {
    expect(isInternalUser('stranger@example.com', allowlist)).toBe(false);
    expect(isInternalUser(null, allowlist)).toBe(false);
    expect(isInternalUser(undefined, allowlist)).toBe(false);
    expect(isInternalUser('', allowlist)).toBe(false);
  });

  it('admits NOBODY when the allowlist is empty', () => {
    // The dangerous alternative would be an empty list meaning "allow
    // everyone", which turns a dropped environment variable into a silent
    // public launch.
    expect(isInternalUser('founder@rooferslabs.com', [])).toBe(false);
  });

  it('does not match a substring or a lookalike domain', () => {
    expect(isInternalUser('founder@rooferslabs.com.evil.com', allowlist)).toBe(false);
    expect(isInternalUser('xfounder@rooferslabs.com', allowlist)).toBe(false);
  });
});
