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
 */
@Module({
  imports: [UsersModule, BillingModule],
  controllers: [AuthController],
  providers: [ClerkService, AuthService, PlatformAdminService],
  exports: [AuthService, ClerkService, PlatformAdminService],
})
export class AuthModule {}
