import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * The early-access form.
 *
 * Every field is bounded. This endpoint is unauthenticated and reachable by
 * anyone on the internet during the beta, so the DTO is the first place a
 * hostile payload is stopped — `MaxLength` on each field means a request cannot
 * be used to write megabytes into the database, and `whitelist: true` on the
 * global validation pipe strips anything not declared here.
 */
export class CreateEarlyAccessRequestDto {
  @ApiProperty({ description: 'Who is asking.' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ description: 'The roofing company they work for.' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  company!: string;

  @ApiProperty({ description: 'Where to reach them.' })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiPropertyOptional({ description: 'Optional — asked for, never required.' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}
