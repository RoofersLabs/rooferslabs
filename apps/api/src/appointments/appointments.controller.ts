import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCompanyId } from '../common/decorators/current-company.decorator';
import { paginated, respond } from '../common/response';
import { AppointmentsService } from './appointments.service';
import {
  AppointmentQueryDto,
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller({ path: 'appointments', version: '1' })
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List appointment requests' })
  async list(@CurrentCompanyId() companyId: string, @Query() query: AppointmentQueryDto) {
    const { items, pagination } = await this.appointments.list(companyId, query);
    return paginated(items, pagination, 'Appointments retrieved.');
  }

  @Post()
  @ApiOperation({ summary: 'Create an appointment request' })
  async create(@CurrentCompanyId() companyId: string, @Body() dto: CreateAppointmentDto) {
    const appointment = await this.appointments.create(companyId, dto);
    return respond(appointment, 'Appointment created.');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an appointment' })
  async get(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    const appointment = await this.appointments.getById(companyId, id);
    return respond(appointment, 'Appointment retrieved.');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an appointment (status, schedule, notes)' })
  async update(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    const appointment = await this.appointments.update(companyId, id, dto);
    return respond(appointment, 'Appointment updated.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an appointment' })
  async remove(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    await this.appointments.remove(companyId, id);
    return respond(null, 'Appointment cancelled.');
  }
}
