/**
 * `npm run billing:paypal:setup` — the provisioning entry point.
 *
 * Makes PayPal match the catalogue in `catalog.config.ts` and records what it
 * made, so the application never needs a plan id, a product id or a webhook id
 * in its environment. The only things this command cannot obtain for you are
 * PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET, because PayPal has no API for
 * minting REST app credentials.
 *
 * Safe to run repeatedly. Every step is lookup-then-create, so a second run
 * reports `reused` for everything and changes nothing. Safe to run against an
 * account that already has the objects — they are adopted rather than
 * duplicated.
 *
 * Exit codes are meaningful, because this belongs in a deploy pipeline:
 *   0  the catalogue is provisioned and billing is ready
 *   1  something is missing or wrong; the reason is printed
 *
 * It boots a deliberately small Nest context — config and Prisma only — so it
 * does not open a Redis connection or a Twilio client on the way to creating a
 * plan.
 *
 * ## Why this lives in `src/` and not in a `scripts/` directory
 *
 * It has to run **inside the VPC**. Every RDS instance in this project is
 * `publicly_accessible = false`, in private subnets, with security-group-only
 * ingress — there is no network path from a laptop to any environment's
 * database, by design. So provisioning runs the same way migrations do: as a
 * one-off ECS task on the environment's own task definition
 * (`infra/scripts/billing.sh`, mirroring `infra/scripts/db.sh`).
 *
 * That task runs the production image, which contains `dist/` and production
 * dependencies and nothing else — no `scripts/` directory and no `tsx`. A file
 * outside `src/` would simply not be there. Living here means `nest build`
 * emits it, and the container can run
 * `node apps/api/dist/billing/provisioning/paypal-setup.cli.js`.
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

/**
 * Credentials are checked BEFORE anything is imported.
 *
 * Importing the Nest module graph runs `ConfigModule.forRoot`, whose validation
 * throws a raw stack trace when a required variable is missing. That is the
 * right behaviour for a booting API and completely wrong for the command whose
 * entire job is to tell an operator what to do next — so the one failure a
 * first-time user will actually hit is caught here, in plain language, before
 * Nest can bury it.
 *
 * The imports below are deliberately dynamic for the same reason: a static
 * import would be hoisted above this check and defeat it.
 */
function missingCredentials(): string[] {
  return ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'].filter((key) => !process.env[key]?.trim());
}

const ICON: Record<string, string> = {
  created: '+',
  reused: '=',
  updated: '~',
  skipped: '!',
  failed: 'x',
};

function printReport(report: {
  environment: string;
  webhookUrl: string;
  steps: { key: string; action: string; externalId?: string; detail: string; drift?: string }[];
  errors: string[];
}): void {
  const line = '─'.repeat(72);
  console.log(`\n${line}`);
  console.log(`  PayPal provisioning — ${report.environment}`);
  console.log(`  Webhook target: ${report.webhookUrl}`);
  console.log(line);

  for (const step of report.steps) {
    console.log(`  ${ICON[step.action] ?? '?'} ${step.key.padEnd(28)} ${step.detail}`);
    if (step.externalId) {
      console.log(`    ${' '.repeat(28)} id: ${step.externalId}`);
    }
    if (step.drift) {
      console.log(`    ${' '.repeat(28)} ⚠ ${step.drift}`);
    }
  }

  if (report.errors.length > 0) {
    console.log(line);
    for (const error of report.errors) {
      console.log(`  ERROR  ${error}`);
    }
  }
  console.log(line);
}

async function main(): Promise<number> {
  const missing = missingCredentials();
  if (missing.length > 0) {
    console.error(
      [
        '',
        `Cannot provision: ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set.`,
        '',
        'These are the only billing values configured by hand — everything else',
        'is created by this command. To get them:',
        '',
        '  1. https://developer.paypal.com/dashboard -> Apps & Credentials',
        '  2. Pick the Sandbox or Live tab, then Create App (type: Merchant)',
        '  3. Put the Client ID and Secret where this environment reads them:',
        '',
        '       development  infra/terraform/envs/development/terraform.tfvars',
        '       production   infra/terraform/envs/production/paypal.auto.tfvars',
        '',
        '         paypal_client_id     = "..."',
        '         paypal_client_secret = "..."',
        '',
        '     then `terraform apply`, so they reach the ECS task definition.',
        '  4. Run `npm run billing:paypal:setup <environment>` again.',
        '',
      ].join('\n'),
    );
    return 1;
  }

  // Imported here, after the check above, so a missing credential produces the
  // message above rather than ConfigModule's stack trace.
  //
  // `.js` extensions because the project resolves modules as NodeNext, under
  // which a dynamic specifier names the emitted file rather than the source. The
  // static imports elsewhere are extensionless because TypeScript resolves those
  // against the source tree; a dynamic one is a runtime path.
  const { BillingProvisioningModule } = await import('./billing-provisioning.module.js');
  const { BillingReadinessService } = await import('./billing-readiness.service.js');
  const { PayPalProvisioningService } = await import('./paypal-provisioning.service.js');

  // `error`/`warn` only: the point of this command is its own output, not Nest's
  // module-initialisation chatter.
  const app = await NestFactory.createApplicationContext(BillingProvisioningModule, {
    logger: ['error', 'warn'],
  });
  app.enableShutdownHooks();

  try {
    const provisioner = app.get(PayPalProvisioningService);
    const readiness = app.get(BillingReadinessService);

    const report = await provisioner.provision();
    printReport(report);

    if (!report.ok) {
      console.error('\nProvisioning did not complete. Fix the errors above and re-run.\n');
      return 1;
    }

    // Provisioning succeeding is not the same as billing working: the closing
    // check re-reads the persisted catalogue and verifies the credentials, so
    // the command's exit code answers "can this deployment take money?" rather
    // than merely "did the API calls return 200?".
    const verdict = await readiness.check({ verifyCredentials: true });
    console.log(`\n${BillingReadinessService.format(verdict)}\n`);

    if (!verdict.ready) {
      console.error('Billing is provisioned but not ready. See the remedies above.\n');
      return 1;
    }

    const webhookId = await readiness.resolveWebhookId();
    console.log('Billing is ready. Nothing else needs configuring.');
    if (webhookId) {
      console.log(
        `Signature verification will use webhook ${webhookId} (discovered, not configured).`,
      );
    }
    console.log('');
    return 0;
  } finally {
    await app.close();
  }
}

/**
 * Only when executed directly.
 *
 * This module sits inside `src/`, which `nest build` compiles wholesale — so
 * without this guard a stray import of anything here would boot a Nest context
 * and start provisioning as a side effect.
 */
if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      new Logger('paypal-setup').error(error instanceof Error ? error.stack : String(error));
      process.exit(1);
    });
}
