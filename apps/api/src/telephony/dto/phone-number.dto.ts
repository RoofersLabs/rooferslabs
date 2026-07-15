import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AssignPhoneNumberDto {
  @ApiProperty({ example: '+15125559000', description: 'Twilio number in E.164 format.' })
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phoneNumber must be E.164, e.g. +15125559000.' })
  phoneNumber!: string;

  @ApiPropertyOptional({ description: 'Twilio phone number SID (PN…).' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  twilioSid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  friendlyName?: string;
}
