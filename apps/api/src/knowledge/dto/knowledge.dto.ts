import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { KnowledgeCategory, KnowledgeStatus } from '@rooferslabs/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CreateKnowledgeArticleDto {
  @ApiProperty({ example: 'Free Roof Inspections' })
  @IsString()
  @Length(2, 200)
  title!: string;

  @ApiProperty({ example: 'We offer free, no-obligation roof inspections…' })
  @IsString()
  @Length(1, 20000)
  content!: string;

  @ApiProperty({ enum: KnowledgeCategory, example: KnowledgeCategory.SERVICES })
  @IsEnum(KnowledgeCategory)
  category!: KnowledgeCategory;

  @ApiPropertyOptional({ type: [String], example: ['inspection', 'free', 'estimate'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  keywords?: string[];

  @ApiPropertyOptional({ enum: KnowledgeStatus, default: KnowledgeStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(KnowledgeStatus)
  status?: KnowledgeStatus;
}

export class UpdateKnowledgeArticleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 20000)
  content?: string;

  @ApiPropertyOptional({ enum: KnowledgeCategory })
  @IsOptional()
  @IsEnum(KnowledgeCategory)
  category?: KnowledgeCategory;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  keywords?: string[];

  @ApiPropertyOptional({ enum: KnowledgeStatus })
  @IsOptional()
  @IsEnum(KnowledgeStatus)
  status?: KnowledgeStatus;
}

export class KnowledgeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: KnowledgeCategory })
  @IsOptional()
  @IsEnum(KnowledgeCategory)
  category?: KnowledgeCategory;

  @ApiPropertyOptional({ enum: KnowledgeStatus })
  @IsOptional()
  @IsEnum(KnowledgeStatus)
  status?: KnowledgeStatus;
}
