import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { CallStatus, ConversationOutcome } from '@rooferslabs/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CallQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CallStatus })
  @IsOptional()
  @IsEnum(CallStatus)
  status?: CallStatus;
}

export class ConversationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ConversationOutcome })
  @IsOptional()
  @IsEnum(ConversationOutcome)
  outcome?: ConversationOutcome;

  @ApiPropertyOptional({ description: 'Filter emergencies only.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  emergency?: boolean;
}
