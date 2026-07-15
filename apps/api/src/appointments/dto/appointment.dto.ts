import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AppointmentPriority, AppointmentStatus } from '@rooferslabs/shared';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CreateAppointmentDto {
  @ApiPropertyOptional({ description: 'Customer this appointment belongs to.' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  serviceRequested?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  propertyAddress?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 date-time.' })
  @IsOptional()
  @IsDateString()
  preferredDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  preferredTimeWindow?: string;

  @ApiPropertyOptional({ enum: AppointmentPriority })
  @IsOptional()
  @IsEnum(AppointmentPriority)
  priority?: AppointmentPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateAppointmentDto extends CreateAppointmentDto {
  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}

export class AppointmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional({ enum: AppointmentPriority })
  @IsOptional()
  @IsEnum(AppointmentPriority)
  priority?: AppointmentPriority;
}
