import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BillingInterval, UserRole } from '@rooferslabs/shared';
import { AllowInactiveSubscription } from '../common/decorators/public.decorator';
import { CurrentCompanyId } from '../common/decorators/current-company.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { respond } from '../common/response';
import { BillingService } from './services/billing.service';
import { ChangePlanDto, CreateCheckoutSessionDto } from './dto/billing.dto';
import { PaymentsEnabledGuard } from './guards/payments-enabled.guard';

/**
 * Tenant-facing billing surface. Every endpoint here is reachable without an
 * active subscription — this is where a blocked tenant goes to become unblocked.
 *
 * Provider-neutral by construction: no route, payload, or response names a
 * payment processor, so switching providers changes nothing a client can see.
 *
 * The whole controller is behind {@link PaymentsEnabledGuard}: while
 * PAYMENTS_ENABLED is off these answer 503 PAYMENTS_DISABLED, and the frontend
 * hides the routes that reach them.
 */
@ApiTags('Billing')
@ApiBearerAuth()
@AllowInactiveSubscription()
@UseGuards(PaymentsEnabledGuard)
@ApiServiceUnavailableResponse({ description: 'Payments are disabled (PAYMENTS_DISABLED).' })
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('config')
  @ApiOperation({
    summary: 'Public billing configuration the browser needs to open a checkout',
  })
  getConfig() {
    // Served rather than baked into the frontend bundle so rotating the token
    // does not require a rebuild and redeploy of the web app.
    return respond(this.billing.getPublicConfig(), 'Billing configuration retrieved.');
  }

  @Get('subscription')
  @ApiOperation({ summary: "Get the company's current subscription state" })
  async getSubscription(@CurrentCompanyId() companyId: string) {
    const subscription = await this.billing.getSummary(companyId);
    return respond(subscription, 'Subscription retrieved.');
  }

  @Get('invoices')
  @ApiOperation({ summary: "The company's payment history" })
  async listInvoices(@CurrentCompanyId() companyId: string) {
    const invoices = await this.billing.listInvoices(companyId);
    return respond(invoices, 'Invoices retrieved.');
  }

  @Post('checkout-session')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Start a checkout for a plan' })
  async createCheckoutSession(
    @CurrentCompanyId() companyId: string,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    const session = await this.billing.createCheckout(companyId, {
      plan: dto.plan,
      interval: dto.interval ?? BillingInterval.MONTH,
    });
    return respond(session, 'Checkout session created.');
  }

  @Post('portal-session')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Open the hosted customer portal' })
  async createPortalSession(@CurrentCompanyId() companyId: string) {
    const session = await this.billing.createBillingPortalSession(companyId);
    return respond(session, 'Billing portal session created.');
  }

  @Post('subscription/plan')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Move to a different plan (upgrades apply now, downgrades at renewal)',
  })
  async changePlan(@CurrentCompanyId() companyId: string, @Body() dto: ChangePlanDto) {
    const subscription = await this.billing.changePlan(companyId, {
      plan: dto.plan,
      interval: dto.interval ?? BillingInterval.MONTH,
    });
    return respond(subscription, 'Plan updated.');
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
