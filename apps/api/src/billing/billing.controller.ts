import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@rooferslabs/shared';
import { AllowInactiveSubscription } from '../common/decorators/public.decorator';
import { CurrentCompanyId } from '../common/decorators/current-company.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { respond } from '../common/response';
import { BillingService } from './billing.service';
import { CreateCheckoutSessionDto } from './dto/billing.dto';

/**
 * Tenant-facing billing surface. Every endpoint here is reachable without an
 * active subscription — this is where a blocked tenant goes to become unblocked.
 */
@ApiTags('Billing')
@ApiBearerAuth()
@AllowInactiveSubscription()
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('subscription')
  @ApiOperation({ summary: "Get the company's current subscription state" })
  async getSubscription(@CurrentCompanyId() companyId: string) {
    const subscription = await this.billing.getSummary(companyId);
    return respond(subscription, 'Subscription retrieved.');
  }

  @Post('checkout-session')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Start Stripe Checkout for a plan' })
  async createCheckoutSession(
    @CurrentCompanyId() companyId: string,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    const session = await this.billing.createCheckoutSession(companyId, dto.plan);
    return respond(session, 'Checkout session created.');
  }

  @Post('portal-session')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Open the Stripe Customer Portal' })
  async createPortalSession(@CurrentCompanyId() companyId: string) {
    const session = await this.billing.createBillingPortalSession(companyId);
    return respond(session, 'Billing portal session created.');
  }

  @Post('subscription/cancel')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Cancel the subscription at the end of the current billing period',
  })
  async cancel(@CurrentCompanyId() companyId: string) {
    const subscription = await this.billing.cancelSubscription(companyId);
    return respond(subscription, 'Subscription will end at the close of the billing period.');
  }

  @Post('subscription/resume')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Undo a pending cancellation' })
  async resume(@CurrentCompanyId() companyId: string) {
    const subscription = await this.billing.resumeSubscription(companyId);
    return respond(subscription, 'Subscription resumed.');
  }
}
