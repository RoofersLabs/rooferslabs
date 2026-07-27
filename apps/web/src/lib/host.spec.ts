import { surfaceForHost } from './host';

/**
 * The edge function sends `admin.<domain>/` to `/admin` before any HTML is
 * served, so in production this rarely decides anything. It matters when the
 * edge is bypassed — a direct CloudFront domain, local development, a preview
 * host — and it must never mistake a customer host for the portal.
 */
describe('surfaceForHost', () => {
  it.each([
    ['admin.rooferslabs.com'],
    ['ADMIN.ROOFERSLABS.COM'],
    ['admin.staging.rooferslabs.com'],
    ['admin.localhost'],
  ])('treats %s as the admin surface', (host) => {
    expect(surfaceForHost(host)).toBe('admin');
  });

  it.each([
    ['rooferslabs.com'],
    ['www.rooferslabs.com'],
    ['localhost'],
    ['d2xct3d999qjfs.cloudfront.net'],
    // The label must match exactly: a lookalike host must not be handed the
    // portal's routing, and a customer host containing the word must not either.
    ['administrator.rooferslabs.com'],
    ['admin-rooferslabs.com'],
    ['notadmin.rooferslabs.com'],
    ['rooferslabs.com.admin.evil.test'],
  ])('treats %s as the customer surface', (host) => {
    expect(surfaceForHost(host)).toBe('customer');
  });

  it.each([[undefined], [null], ['']])('falls back to customer for %s', (host) => {
    // Fail toward the customer app: showing marketing to staff is a nuisance,
    // showing the portal's shell to a customer is not.
    expect(surfaceForHost(host)).toBe('customer');
  });
});
