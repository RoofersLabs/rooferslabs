import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AiVoice } from '@rooferslabs/shared';

/** Update the AI receptionist configuration (onboarding "AI" step). */
export class UpdateAiConfigurationDto {
  @ApiPropertyOptional({ enum: AiVoice, example: AiVoice.ALLOY })
  @IsOptional()
  @IsEnum(AiVoice)
  voice?: AiVoice;

  @ApiPropertyOptional({ example: 'Riley from Summit Roofing' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  assistantName?: string;

  @ApiPropertyOptional({ description: 'First thing the AI says when answering.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  greeting?: string;

  @ApiPropertyOptional({ example: 'professional, warm, and efficient' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  persona?: string;

  @ApiPropertyOptional({ description: 'Additional company-specific instructions for the AI.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  customInstructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  captureLeads?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  detectEmergencies?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requestAppointments?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  transferToHuman?: boolean;

  @ApiPropertyOptional({ description: 'Number to transfer to when human handoff is enabled.' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  transferPhone?: string;
}
