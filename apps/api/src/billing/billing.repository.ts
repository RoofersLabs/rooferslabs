import { Injectable } from '@nestjs/common';
import type { Prisma, Subscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Data access for the tenant billing read-model mirrored from Stripe. */
@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCompanyId(companyId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { companyId } });
  }

  findByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { stripeCustomerId } });
  }

  findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { stripeSubscriptionId } });
  }

  create(data: Prisma.SubscriptionUncheckedCreateInput): Promise<Subscription> {
    return this.prisma.subscription.create({ data });
  }

  update(companyId: string, data: Prisma.SubscriptionUpdateInput): Promise<Subscription> {
    return this.prisma.subscription.update({ where: { companyId }, data });
  }
}
