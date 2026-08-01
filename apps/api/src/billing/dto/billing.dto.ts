import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BillingInterval, SubscriptionPlan } from '@rooferslabs/shared';

/**
 * Payload to start a checkout.
 *
 * Deliberately names a *plan*, never a price. The client cannot choose what it
 * pays: the server resolves the plan to the price configured for the active
 * provider, so a tampered request can only ever ask for a plan we actually
 * sell — at the amount we set.
 */
export class CreateCheckoutSessionDto {
  @ApiProperty({ enum: SubscriptionPlan, example: SubscriptionPlan.STARTER })
  @IsEnum(SubscriptionPlan)
  plan!: SubscriptionPlan;

  /** Defaults to monthly, the only cadence currently sold. */
  @ApiPropertyOptional({ enum: BillingInterval, default: BillingInterval.MONTH })
  @IsOptional()
  @IsEnum(BillingInterval)
  interval?: BillingInterval;
}

/**
 * The subscription PayPal hands back on the return redirect.
 *
 * Treated as an untrusted hint, never as proof of anything. The id is used only
 * to *look the subscription up at PayPal*, and the tenant is taken from the
 * authenticated session — so a caller who invents or steals someone else's id
 * learns nothing and changes nothing. See `BillingService.confirmCheckout`.
 *
 * The pattern is PayPal's own subscription format. Constraining it here keeps a
 * hostile string out of a URL path we are about to build.
 */
export class ConfirmCheckoutDto {
  @ApiProperty({ example: 'I-BW452GLLEP1G' })
  @IsString()
  @MaxLength(64)
  @Matches(/^I-[A-Z0-9]{6,50}$/, {
    message: 'subscriptionId must be a PayPal subscription id.',
  })
  subscriptionId!: string;
}

/** Payload to move an existing subscription to a different plan. */
export class ChangePlanDto {
  @ApiProperty({ enum: SubscriptionPlan, example: SubscriptionPlan.PROFESSIONAL })
  @IsEnum(SubscriptionPlan)
  plan!: SubscriptionPlan;

  @ApiPropertyOptional({ enum: BillingInterval, default: BillingInterval.MONTH })
  @IsOptional()
  @IsEnum(BillingInterval)
  interval?: BillingInterval;
}
