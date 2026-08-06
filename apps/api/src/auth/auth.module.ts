import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ClerkService } from './clerk.service';
import { PlatformAdminService } from './platform-admin.service';

/**
 * Authentication module. Owns the Clerk adapter and the auth service, and
 * exports {@link AuthService} for the global {@link ClerkAuthGuard} and
 * {@link PlatformAdminService} for the admin portal's guard.
 *
 * {@link AccountStatusService} used to live here. It now has its own global
 * module: every runtime subsystem depends on it, and routing telephony and the
 * OpenAI adapters through this module — which imports billing and users — to
 * reach it would have been a dependency edge with no meaning behind it.
 */
@Module({
  imports: [UsersModule, BillingModule],
  controllers: [AuthController],
  providers: [ClerkService, AuthService, PlatformAdminService],
  exports: [AuthService, ClerkService, PlatformAdminService],
})
export class AuthModule {}
