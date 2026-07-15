import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/** Payload to create a company — the first step of onboarding. */
export class CreateCompanyDto {
  @ApiProperty({ example: 'Summit Roofing Co.', description: 'Legal or trading business name.' })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiPropertyOptional({ example: 'office@summitroofing.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '+15125550100',
    description: 'The existing business phone number the company will keep.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({ example: 'Austin' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 'TX' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  state?: string;
}
