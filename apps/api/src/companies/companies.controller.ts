import { Body, Controller, Get, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@rooferslabs/shared';
import { AllowNoCompany } from '../common/decorators/public.decorator';
import { CurrentCompanyId } from '../common/decorators/current-company.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { respond } from '../common/response';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateAiConfigurationDto } from './dto/ai-configuration.dto';
import { SetBusinessHoursDto } from './dto/business-hours.dto';
import { SetOnboardingStepDto } from './dto/onboarding.dto';
import { UpdateBrandingDto, UpdateCompanyDto } from './dto/update-company.dto';

/**
 * Company (tenant) management, and the write surface behind the guided
 * onboarding wizard.
 *
 * The wizard writes its progress through these endpoints; @AllowNoCompany marks
 * the one that runs before a tenant record exists at all.
 */
@ApiTags('Companies')
@ApiBearerAuth()
@Controller({ path: 'companies', version: '1' })
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Post()
  @AllowNoCompany()
  @ApiOperation({ summary: 'Create the founding company (onboarding step 1)' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCompanyDto) {
    const company = await this.companies.create(user, dto);
    return respond(company, 'Company created.');
  }

  @Get('me')
  @ApiOperation({ summary: "Get the caller's company" })
  async getMine(@CurrentCompanyId() companyId: string) {
    const company = await this.companies.getById(companyId);
    return respond(company, 'Company retrieved.');
  }

  @Patch('me')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update business information (onboarding step 2)' })
  async update(@CurrentCompanyId() companyId: string, @Body() dto: UpdateCompanyDto) {
    const company = await this.companies.updateBusinessInfo(companyId, dto);
    return respond(company, 'Business information updated.');
  }

  @Put('me/business-hours')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Set business hours (onboarding step 2)' })
  async setHours(@CurrentCompanyId() companyId: string, @Body() dto: SetBusinessHoursDto) {
    const company = await this.companies.setBusinessHours(companyId, dto.hours);
    return respond(company, 'Business hours updated.');
  }

  @Patch('me/branding')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update branding (logo and colors)' })
  async updateBranding(@CurrentCompanyId() companyId: string, @Body() dto: UpdateBrandingDto) {
    const company = await this.companies.updateBranding(companyId, dto);
    return respond(company, 'Branding updated.');
  }

  @Get('me/ai-configuration')
  @ApiOperation({ summary: 'Get the AI receptionist configuration' })
  async getAiConfig(@CurrentCompanyId() companyId: string) {
    const config = await this.companies.getAiConfiguration(companyId);
    return respond(config, 'AI configuration retrieved.');
  }

  @Patch('me/ai-configuration')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update the AI receptionist configuration (onboarding step 3)' })
  async updateAiConfig(
    @CurrentCompanyId() companyId: string,
    @Body() dto: UpdateAiConfigurationDto,
  ) {
    const config = await this.companies.updateAiConfiguration(companyId, dto);
    return respond(config, 'AI configuration updated.');
  }

  @Patch('me/onboarding')
  @ApiOperation({ summary: 'Advance the onboarding wizard to a step' })
  async setStep(@CurrentCompanyId() companyId: string, @Body() dto: SetOnboardingStepDto) {
    const company = await this.companies.setOnboardingStep(companyId, dto.step);
    return respond(company, 'Onboarding step updated.');
  }

  @Post('me/onboarding/complete')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Complete onboarding (step 4) — setup is finished' })
  async complete(@CurrentCompanyId() companyId: string) {
    const company = await this.companies.completeOnboarding(companyId);
    return respond(company, 'Setup complete. Choose a plan to activate your receptionist.');
  }
}
