import { fetchLaunchAccess, fetchLaunchMode } from './launchMode';

// `@/config` reads import.meta.env, which ts-jest cannot compile — the web Jest
// config pins `module: CommonJS`, where import.meta is a syntax error. Only the
// API origin is needed here, and an empty origin is what local development
// actually uses (requests resolve same-origin through the Vite proxy).
jest.mock('@/config', () => ({
  config: { apiBaseUrl: '', clerkPublishableKey: 'pk_test_x', configErrors: [] },
}));

// The shared api-client attaches a Clerk token and has module-level state; the
// launch access check only cares that a truthy `allowed` came back.
jest.mock('@/lib/api-client', () => ({
  api: { get: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require('@/lib/api-client') as { api: { get: jest.Mock } };

const originalFetch = global.fetch;

function mockFetch(impl: () => Promise<unknown>) {
  global.fetch = jest.fn(impl) as unknown as typeof fetch;
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

describe('fetchLaunchMode', () => {
  it('reads the mode out of the response envelope', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ data: { mode: 'private' } }) }));
    await expect(fetchLaunchMode()).resolves.toBe('private');

    mockFetch(async () => ({ ok: true, json: async () => ({ data: { mode: 'public' } }) }));
    await expect(fetchLaunchMode()).resolves.toBe('public');
  });

  it('falls back to the build-time value when the API is unreachable', async () => {
    // In a test build __APP_ENV__ is not production, so the fallback is public.
    // The point of the assertion is that a network failure resolves rather than
    // rejecting — an unhandled rejection here would blank the whole app.
    mockFetch(async () => {
      throw new Error('network down');
    });
    await expect(fetchLaunchMode()).resolves.toBe('public');
  });

  it('falls back on a non-2xx response', async () => {
    mockFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    await expect(fetchLaunchMode()).resolves.toBe('public');
  });

  it('falls back on an unrecognised mode rather than inventing one', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ data: { mode: 'beta' } }) }));
    await expect(fetchLaunchMode()).resolves.toBe('public');
  });
});

describe('fetchLaunchAccess', () => {
  it('is true only when the API says allowed', async () => {
    api.get.mockResolvedValueOnce({ allowed: true });
    await expect(fetchLaunchAccess()).resolves.toBe(true);

    api.get.mockResolvedValueOnce({ allowed: false });
    await expect(fetchLaunchAccess()).resolves.toBe(false);
  });

  it('denies on any failure — "could not confirm" must look like "not allowed"', async () => {
    api.get.mockRejectedValueOnce(new Error('403'));
    await expect(fetchLaunchAccess()).resolves.toBe(false);
  });

  it('denies on a malformed payload rather than coercing it', async () => {
    api.get.mockResolvedValueOnce({ allowed: 'yes' });
    await expect(fetchLaunchAccess()).resolves.toBe(false);

    api.get.mockResolvedValueOnce({});
    await expect(fetchLaunchAccess()).resolves.toBe(false);
  });
});
