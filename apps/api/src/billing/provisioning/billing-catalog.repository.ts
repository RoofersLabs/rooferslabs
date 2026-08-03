/**
 * Data access for the provisioned catalogue.
 *
 * Every read and write is scoped by provider *and* environment. That scoping is
 * the safety property: a sandbox plan id and a live one are different objects,
 * and a process pointed at the live estate must never be able to read a row a
 * sandbox run wrote.
 */
import { Injectable } from '@nestjs/common';
import type { BillingCatalog, Prisma } from '@prisma/client';
import type { PaymentProvider } from '@rooferslabs/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface CatalogScope {
  provider: PaymentProvider;
  environment: string;
}

@Injectable()
export class BillingCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(scope: CatalogScope, key: string): Promise<BillingCatalog | null> {
    return this.prisma.billingCatalog.findUnique({
      where: {
        provider_environment_key: {
          provider: scope.provider,
          environment: scope.environment,
          key,
        },
      },
    });
  }

  findAll(scope: CatalogScope): Promise<BillingCatalog[]> {
    return this.prisma.billingCatalog.findMany({
      where: { provider: scope.provider, environment: scope.environment },
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Record what the provider issued.
   *
   * An upsert on the unique `(provider, environment, key)` index, which is what
   * makes provisioning safe to run twice — or twice concurrently from two ECS
   * tasks. The database, not the application, is what prevents a second row
   * claiming to be the same plan.
   */
  upsert(
    scope: CatalogScope,
    entry: {
      key: string;
      externalId: string;
      fingerprint: string;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<BillingCatalog> {
    const data = {
      externalId: entry.externalId,
      fingerprint: entry.fingerprint,
      ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }),
    };

    return this.prisma.billingCatalog.upsert({
      where: {
        provider_environment_key: {
          provider: scope.provider,
          environment: scope.environment,
          key: entry.key,
        },
      },
      create: {
        provider: scope.provider,
        environment: scope.environment,
        key: entry.key,
        ...data,
      },
      update: data,
    });
  }
}
