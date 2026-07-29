import { Injectable } from '@nestjs/common';
import type { PaymentProvider } from '@rooferslabs/shared';
import type { Prisma, Subscription } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Data access for the tenant billing read-model.
 *
 * Lookups by provider identifier are always scoped by provider: the same-looking
 * id can exist under two processors, and a tenant that has moved between them
 * has a row under each. Querying without the qualifier would be the kind of bug
 * that silently applies one provider's event to another's subscription.
 */
@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCompanyId(companyId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { companyId } });
  }

  findByProviderCustomerId(
    provider: PaymentProvider,
    providerCustomerId: string,
  ): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({
      where: { provider_providerCustomerId: { provider, providerCustomerId } },
    });
  }

  findByProviderSubscriptionId(
    provider: PaymentProvider,
    providerSubscriptionId: string,
  ): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({
      where: { provider_providerSubscriptionId: { provider, providerSubscriptionId } },
    });
  }

  create(data: Prisma.SubscriptionUncheckedCreateInput): Promise<Subscription> {
    return this.prisma.subscription.create({ data });
  }

  update(companyId: string, data: Prisma.SubscriptionUpdateInput): Promise<Subscription> {
    return this.prisma.subscription.update({ where: { companyId }, data });
  }

  /**
   * Write the tenant's billing state, creating the row if this is its first.
   * Keyed on `companyId` because a tenant has exactly one live subscription —
   * that uniqueness is what makes the upsert safe under concurrent webhooks.
   */
  upsert(
    companyId: string,
    data: Omit<Prisma.SubscriptionUncheckedCreateInput, 'companyId'>,
  ): Promise<Subscription> {
    return this.prisma.subscription.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });
  }
}
