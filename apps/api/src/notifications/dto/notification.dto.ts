import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { NotificationStatus, NotificationType } from '@rooferslabs/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class NotificationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: NotificationStatus })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}

class PushKeysDto {
  @ApiProperty()
  @IsString()
  @MaxLength(512)
  p256dh!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(256)
  auth!: string;
}

export class SavePushSubscriptionDto {
  @ApiProperty({ description: 'The push service endpoint URL for this browser.' })
  @IsUrl({ require_tld: false })
  @MaxLength(1024)
  endpoint!: string;

  @ApiProperty({ type: PushKeysDto })
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  userAgent?: string;
}

export class RemovePushSubscriptionDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  @MaxLength(1024)
  endpoint!: string;
}
