import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PAGINATION_DEFAULTS } from '@rooferslabs/shared';

/**
 * Base query parameters supported by every collection endpoint
 * (docs/09_API_Standards.md §19–22). Feature DTOs extend this to add filters.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based).', default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page: number = PAGINATION_DEFAULTS.page;

  @ApiPropertyOptional({
    description: 'Items per page.',
    default: PAGINATION_DEFAULTS.limit,
    maximum: PAGINATION_DEFAULTS.maxLimit,
  })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(PAGINATION_DEFAULTS.maxLimit)
  limit: number = PAGINATION_DEFAULTS.limit;

  @ApiPropertyOptional({
    description: 'Sort expression, e.g. "createdAt:desc".',
    example: 'createdAt:desc',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ description: 'Case-insensitive free-text search.' })
  @IsOptional()
  @IsString()
  search?: string;
}
