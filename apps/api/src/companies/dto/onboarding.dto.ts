import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OnboardingStep } from '@rooferslabs/shared';

export class SetOnboardingStepDto {
  @ApiProperty({ enum: OnboardingStep, example: OnboardingStep.AI })
  @IsEnum(OnboardingStep)
  step!: OnboardingStep;
}
