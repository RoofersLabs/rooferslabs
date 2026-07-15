import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BusinessHourDto {
  @ApiProperty({ enum: DAYS, example: 'monday' })
  @IsIn(DAYS)
  day!: (typeof DAYS)[number];

  @ApiProperty({ example: '07:00', description: '24-hour HH:mm.' })
  @IsString()
  @Matches(TIME_PATTERN, { message: 'open must be HH:mm (24-hour).' })
  open!: string;

  @ApiProperty({ example: '18:00', description: '24-hour HH:mm.' })
  @IsString()
  @Matches(TIME_PATTERN, { message: 'close must be HH:mm (24-hour).' })
  close!: string;

  @ApiProperty({ example: false, description: 'True if the business is closed that day.' })
  @IsBoolean()
  closed!: boolean;
}

export class SetBusinessHoursDto {
  @ApiProperty({ type: [BusinessHourDto] })
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => BusinessHourDto)
  hours!: BusinessHourDto[];
}
