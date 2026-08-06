import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CompanyStatus } from '@rooferslabs/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AdminCompanyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CompanyStatus })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  /** Billing bucket, which is what "trial / active / inactive" means here. */
  @ApiPropertyOptional({ enum: ['TRIAL', 'ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsIn(['TRIAL', 'ACTIVE', 'INACTIVE'])
  subscription?: 'TRIAL' | 'ACTIVE' | 'INACTIVE';

  // `sort` is inherited from PaginationQueryDto as a validated string. It is
  // deliberately not redeclared here: a `declare` field is erased at compile
  // time, so its class-validator decorators would never run. The service treats
  // anything other than 'name' as the default ordering, so an unknown value
  // degrades to that rather than reaching the database.
}

export class AdminSearchQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class AdminAnalyticsQueryDto {
  @ApiPropertyOptional({ enum: ['7', '30'] })
  @IsOptional()
  @IsIn(['7', '30'])
  days?: '7' | '30';
}

/**
 * The optional note behind a pause.
 *
 * Internal by design: it is written by staff for staff, stored on the tenant row
 * and shown in the portal, and never travels to the paused customer — their
 * screen points them at support, who can explain the situation with the context
 * a one-line reason cannot carry.
 */
export class PauseCompanyDto {
  @ApiPropertyOptional({ description: 'Internal note. Never shown to the customer.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateCompanyNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}
