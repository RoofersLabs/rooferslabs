import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';

/**
 * `AuthModule` is imported for the Clerk adapter that `PlatformAdminGuard`
 * confirms staff identity against. It is a dependency of the guard, not of the
 * service: nothing in here talks to Clerk.
 */
@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
})
export class AdminModule {}
