import { Injectable } from '@nestjs/common';
import type { Invoice } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ProviderInvoice } from '../types/billing.types';

/** Data access for synchronized billing documents. */
@Injectable()
export class InvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** A tenant's billing history, newest first. */
  listByCompanyId(companyId: string, limit: number): Promise<Invoice[]> {
    return this.prisma.invoice.findMany({
      where: { companyId },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  /**
   * Mirror one provider invoice into the local table.
   *
   * Upserted on `(provider, providerInvoiceId)` so a redelivered webhook — or a
   * reconciliation sweep that re-reads the same document — updates the existing
   * row instead of inserting a duplicate. This is the invoice half of webhook
   * idempotency, and it holds even if the ledger check is bypassed.
   */
  sync(
    companyId: string,
    subscriptionId: string | null,
    invoice: ProviderInvoice,
  ): Promise<Invoice> {
    const data = {
      companyId,
      subscriptionId,
      number: invoice.number,
      status: invoice.status,
      currency: invoice.currency,
      amountDue: invoice.amountDue,
      amountPaid: invoice.amountPaid,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
      invoiceUrl: invoice.invoiceUrl,
    };

    return this.prisma.invoice.upsert({
      where: {
        provider_providerInvoiceId: {
          provider: invoice.provider,
          providerInvoiceId: invoice.providerInvoiceId,
        },
      },
      create: {
        provider: invoice.provider,
        providerInvoiceId: invoice.providerInvoiceId,
        ...data,
      },
      update: data,
    });
  }
}
