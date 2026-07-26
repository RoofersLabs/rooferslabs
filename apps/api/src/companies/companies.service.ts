import { Injectable, Logger } from '@nestjs/common';
import type { AiConfiguration, Prisma } from '@prisma/client';
import { CompanyStatus, OnboardingStep } from '@rooferslabs/shared';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '../common/exceptions/domain.exception';
import { ApiErrorCode } from '@rooferslabs/shared';
import { RedisService } from '../redis/redis.service';
import { PhoneNumbersService } from '../telephony/phone-numbers.service';
import { CompaniesRepository, type CompanyWithRelations } from './companies.repository';
import type { CreateCompanyDto } from './dto/create-company.dto';
import type { UpdateBrandingDto, UpdateCompanyDto } from './dto/update-company.dto';
import type { UpdateAiConfigurationDto } from './dto/ai-configuration.dto';
import type { BusinessHourDto } from './dto/business-hours.dto';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);
  private readonly cacheTtl = 300;

  constructor(
    private readonly repo: CompaniesRepository,
    private readonly redis: RedisService,
    private readonly phoneNumbers: PhoneNumbersService,
  ) {}

  private cacheKey(id: string): string {
    return `company:${id}`;
  }

  private async invalidate(id: string): Promise<void> {
    await this.redis.del(this.cacheKey(id));
  }

  /** Create the founding company for a user who does not yet have one. */
  async create(user: AuthenticatedUser, dto: CreateCompanyDto): Promise<CompanyWithRelations> {
    if (user.companyId) {
      throw new ConflictError('This account already belongs to a company.');
    }
    const slug = await this.generateUniqueSlug(dto.name);

    const company = await this.repo.createWithOwner(user.id, {
      name: dto.name,
      slug,
      status: CompanyStatus.ONBOARDING,
      onboardingStep: OnboardingStep.BUSINESS,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      city: dto.city ?? null,
      state: dto.state ?? null,
    });
    this.logger.log(`Company created: ${company.id} (${company.slug})`);
    return company;
  }

  /** Load the caller's company (cached). */
  async getById(companyId: string): Promise<CompanyWithRelations> {
    const cached = await this.redis.get<CompanyWithRelations>(this.cacheKey(companyId));
    if (cached) return cached;

    const company = await this.repo.findById(companyId);
    if (!company) throw new NotFoundError('Company not found.', ApiErrorCode.COMPANY_NOT_FOUND);

    await this.redis.set(this.cacheKey(companyId), company, this.cacheTtl);
    return company;
  }

  async updateBusinessInfo(
    companyId: string,
    dto: UpdateCompanyDto,
  ): Promise<CompanyWithRelations> {
    await this.repo.update(companyId, { ...dto });
    await this.invalidate(companyId);
    return this.getById(companyId);
  }

  async setBusinessHours(
    companyId: string,
    hours: BusinessHourDto[],
  ): Promise<CompanyWithRelations> {
    await this.repo.update(companyId, {
      businessHours: hours as unknown as Prisma.InputJsonValue,
    });
    await this.invalidate(companyId);
    return this.getById(companyId);
  }

  async updateBranding(companyId: string, dto: UpdateBrandingDto): Promise<CompanyWithRelations> {
    await this.repo.update(companyId, { ...dto });
    await this.invalidate(companyId);
    return this.getById(companyId);
  }

  async getAiConfiguration(companyId: string): Promise<AiConfiguration> {
    const config = await this.repo.getAiConfiguration(companyId);
    if (!config) throw new NotFoundError('AI configuration not found.');
    return config;
  }

  async updateAiConfiguration(
    companyId: string,
    dto: UpdateAiConfigurationDto,
  ): Promise<AiConfiguration> {
    await this.getAiConfiguration(companyId); // ensure exists
    const updated = await this.repo.updateAiConfiguration(companyId, { ...dto });
    await this.invalidate(companyId);
    return updated;
  }

  /**
   * Master switch for the AI receptionist. Disabling changes call handling
   * only — the company, number, knowledge base, and history are untouched,
   * and re-enabling restores answering instantly.
   */
  async setReceptionistEnabled(companyId: string, enabled: boolean): Promise<CompanyWithRelations> {
    await this.repo.update(companyId, { receptionistEnabled: enabled });
    await this.invalidate(companyId);
    this.logger.log(`AI receptionist ${enabled ? 'enabled' : 'disabled'} for company ${companyId}`);
    return this.getById(companyId);
  }

  async setOnboardingStep(companyId: string, step: OnboardingStep): Promise<CompanyWithRelations> {
    await this.repo.update(companyId, { onboardingStep: step });
    await this.invalidate(companyId);
    return this.getById(companyId);
  }

  /**
   * Finalize the guided setup wizard. This marks configuration as done; it does
   * not make the tenant operational — the payment step comes next.
   *
   * Phone-number provisioning deliberately does *not* happen here. Onboarding
   * now runs before the payment wall, so provisioning on completion would buy a
   * real Twilio number for every tenant that finished setup and then never
   * paid. It moved to subscription activation (see BillingService), which is the
   * first moment a tenant is genuinely entitled to a number.
   */
  async completeOnboarding(companyId: string): Promise<CompanyWithRelations> {
    const company = await this.getById(companyId);
    if (!company.name) {
      throw new BusinessRuleError('Company information must be completed before finishing setup.');
    }
    await this.repo.update(companyId, {
      onboardingStep: OnboardingStep.COMPLETE,
      status: CompanyStatus.ACTIVE,
      onboardedAt: new Date(),
    });
    await this.invalidate(companyId);
    this.logger.log(`Onboarding completed for company ${companyId}`);
    return this.getById(companyId);
  }

  /**
   * Purchase the company's dedicated AI number, called when a subscription
   * becomes active. Idempotent, and never throws: a provisioning failure must
   * not fail the Stripe webhook that triggered it (Stripe would retry the whole
   * event, and the tenant is already paid). The owner retries from Phone Setup,
   * where the same error surfaces, and the failure is logged with its stack.
   */
  async provisionReceptionistNumber(companyId: string): Promise<void> {
    try {
      const company = await this.getById(companyId);
      await this.phoneNumbers.provisionForCompany(companyId, {
        companyName: company.name,
        businessPhone: company.phone,
      });
    } catch (error) {
      this.logger.error(
        `Automatic phone number provisioning failed for ${companyId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'company';

    for (let attempt = 0; attempt < 6; attempt++) {
      const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 7)}`;
      const existing = await this.repo.findBySlug(candidate);
      if (!existing) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}
