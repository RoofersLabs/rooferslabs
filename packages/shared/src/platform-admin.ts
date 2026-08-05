/**
 * Who is rooferslabs staff.
 *
 * One definition, shared by the API that enforces it and the web app that
 * follows it, because two definitions of "is this person an admin" is how a
 * portal ends up open on one surface and closed on the other.
 *
 * The rule is an allow-list of email addresses rather than a role in the
 * database, and that is deliberate. A role column is state: it can be granted
 * by mistake, restored by a snapshot, or written by anything that can reach the
 * database, and none of those leave a trace at the door. This list is code — it
 * changes by a commit, a review and a deploy, and the platform's authority is
 * whatever the deployed build says it is.
 *
 * The address itself is the *verified primary email* of a Clerk account. Clerk
 * will not attach an address to an account until the person has proved they
 * receive mail at it, and rooferslabs owns this domain, so nobody can arrive
 * holding one of these addresses without also holding the mailbox.
 *
 * For the MVP the list is one person. It is written as a list anyway: the
 * second staff account is a one-line change here rather than a redesign, and
 * every caller is already asking the right question.
 */
export const PLATFORM_ADMIN_EMAILS: readonly string[] = ['founder@rooferslabs.com'];

/**
 * Normalised for comparison: case-folded and trimmed.
 *
 * Email local parts are case-sensitive by the letter of RFC 5321 and
 * case-insensitive in the practice of every mail provider anyone uses, Clerk
 * included — so `Founder@RoofersLabs.com` and `founder@rooferslabs.com` are one
 * account, and an authorisation check that disagreed would be a lock-out
 * waiting for someone to capitalise their own name.
 */
function normalize(email: string): string {
  return email.trim().toLowerCase();
}

const ADMIN_EMAILS = new Set(PLATFORM_ADMIN_EMAILS.map(normalize));

/**
 * Whether an email address belongs to platform staff.
 *
 * Total on purpose: null, undefined and empty are all "no". Callers hold
 * values that are optional at the type level — a principal that failed to
 * resolve, a Clerk account with no primary address — and the alternative is
 * every one of them writing its own guard against the same three cases.
 */
export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(normalize(email));
}
