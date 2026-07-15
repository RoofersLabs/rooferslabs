import { Injectable } from '@nestjs/common';
import type { AiConfiguration, Company, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CompanyWithRelations = Company & {
  aiConfiguration: AiConfiguration | null;
  phoneNumbers: { id: string; phoneNumber: string; status: string; forwardingVerifiedAt: Date | null }[];
};

/** Data-access for the Company and AiConfiguration entities. */
@Injectable()
export class CompaniesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<CompanyWithRelations | null> {
    return this.prisma.company.findUnique({
      where: { id },
      include: {
        aiConfiguration: true,
        phoneNumbers: {
          select: { id: true, phoneNumber: true, status: true, forwardingVerifiedAt: true },
        },
      },
    });
  }

  findBySlug(slug: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { slug } });
  }

  update(id: string, data: Prisma.CompanyUpdateInput): Promise<Company> {
    return this.prisma.company.update({ where: { id }, data });
  }

  getAiConfiguration(companyId: string): Promise<AiConfiguration | null> {
    return this.prisma.aiConfiguration.findUnique({ where: { companyId } });
  }

  updateAiConfiguration(
    companyId: string,
    data: Prisma.AiConfigurationUpdateInput,
  ): Promise<AiConfiguration> {
    return this.prisma.aiConfiguration.update({ where: { companyId }, data });
  }

  /**
   * Create a company, link the founding user as OWNER, and create the default
   * AI configuration — atomically.
   */
  async createWithOwner(
    userId: string,
    companyData: Prisma.CompanyCreateInput,
  ): Promise<CompanyWithRelations> {
    return this.prisma.runInTransaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          ...companyData,
          aiConfiguration: { create: {} },
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { companyId: company.id, role: 'OWNER' },
      });
      const full = await tx.company.findUniqueOrThrow({
        where: { id: company.id },
        include: {
          aiConfiguration: true,
          phoneNumbers: {
            select: { id: true, phoneNumber: true, status: true, forwardingVerifiedAt: true },
          },
        },
      });
      return full;
    });
  }
}
