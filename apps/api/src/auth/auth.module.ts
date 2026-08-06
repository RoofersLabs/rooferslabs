import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { UsersModule } from '../users/users.module';
import { AccountStatusService } from './account-status.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ClerkService } from './clerk.service';
import { PlatformAdminService } from './platform-admin.service';

/**
 * Authentication module. Owns the Clerk adapter and the auth service, and
 * exports {@link AuthService} for the global {@link ClerkAuthGuard},
 * {@link AccountStatusService} for the global {@link AccountStatusGuard}, and
 * {@link PlatformAdminService} for the admin portal's guard.
 */
@Module({
  imports: [UsersModule, BillingModule],
  controllers: [AuthController],
  providers: [ClerkService, AuthService, AccountStatusService, PlatformAdminService],
  exports: [AuthService, ClerkService, AccountStatusService, PlatformAdminService],
})
export class AuthModule {}
