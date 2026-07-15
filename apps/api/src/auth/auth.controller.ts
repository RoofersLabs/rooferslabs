import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllowNoCompany } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { respond } from '../common/response';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @AllowNoCompany()
  @ApiOperation({
    summary: 'Get the current session',
    description:
      'Returns the authenticated user and their company (null during onboarding). The platform user is provisioned automatically on first authenticated request.',
  })
  @ApiOkResponse({ description: 'The current user and company summary.' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    const session = await this.authService.getSession(user);
    return respond(session, 'Authenticated.');
  }
}
