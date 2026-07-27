import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SubscriptionPlan } from '@rooferslabs/shared';

/** Payload to start Stripe Checkout for a plan. */
export class CreateCheckoutSessionDto {
  @ApiProperty({ enum: SubscriptionPlan, example: SubscriptionPlan.STARTER })
  @IsEnum(SubscriptionPlan)
  plan!: SubscriptionPlan;
}
