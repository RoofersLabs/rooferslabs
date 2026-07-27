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
import { CustomersService } from './customers.service';
import { CreateCustomerDto, CustomerQueryDto, UpdateCustomerDto } from './dto/customer.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller({ path: 'customers', version: '1' })
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'List customers' })
  async list(@CurrentCompanyId() companyId: string, @Query() query: CustomerQueryDto) {
    const { items, pagination } = await this.customers.list(companyId, query);
    return paginated(items, pagination, 'Customers retrieved.');
  }

  @Post()
  @ApiOperation({ summary: 'Create a customer' })
  async create(@CurrentCompanyId() companyId: string, @Body() dto: CreateCustomerDto) {
    const customer = await this.customers.create(companyId, dto);
    return respond(customer, 'Customer created.');
  }

  // Returns the customer with their recent conversations and appointments, so
  // the profile page renders from one request rather than three.
  @Get(':id')
  @ApiOperation({ summary: 'Get a customer with their recent calls and appointments' })
  async get(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    const customer = await this.customers.getDetailById(companyId, id);
    return respond(customer, 'Customer retrieved.');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a customer' })
  async update(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    const customer = await this.customers.update(companyId, id, dto);
    return respond(customer, 'Customer updated.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (archive) a customer' })
  async remove(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    await this.customers.remove(companyId, id);
    return respond(null, 'Customer deleted.');
  }
}
