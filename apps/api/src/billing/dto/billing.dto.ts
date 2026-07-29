import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
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
