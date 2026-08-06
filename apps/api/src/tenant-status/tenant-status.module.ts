import { Global, Module } from '@nestjs/common';
import { AccountStatusService } from './account-status.service';

/**
 * The tenant gate, available everywhere.
 *
 * Global, like {@link PrismaModule} and {@link RedisModule}, and for the same
 * reason: every runtime subsystem on this platform has to be able to ask whether
 * a tenant may be worked for, and requiring each of them to import a module to
 * do it would make the gate something a developer opts into. Infrastructure that
 * everything depends on should not be wiring anybody thinks about.
 *
 * It also breaks a cycle that would otherwise be real. The service used to live
 * in `AuthModule`, which imports `UsersModule` and `BillingModule` — so gating
 * the OpenAI adapter on tenant status would have made `AiModule` depend on
 * billing, transitively, to answer a question that needs nothing but a primary
 * key lookup. Here it depends on Prisma and nothing else.
 */
@Global()
@Module({
  providers: [AccountStatusService],
  exports: [AccountStatusService],
})
export class TenantStatusModule {}
