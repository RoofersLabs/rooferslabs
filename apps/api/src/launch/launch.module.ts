import { Module } from '@nestjs/common';
import { LaunchController } from './launch.controller';
import { LaunchService } from './launch.service';

/**
 * The pre-launch surface: the public launch state and the early-access form.
 *
 * Intentionally self-contained and dependency-light. When the beta ends this
 * module does not have to be removed — the gate is switched off by
 * configuration and these endpoints become harmlessly inert, with the
 * early-access records kept as the sales leads they are.
 */
@Module({
  controllers: [LaunchController],
  providers: [LaunchService],
})
export class LaunchModule {}
