import { CanActivate, Injectable } from '@nestjs/common';
import { PaymentsDisabledError } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Closes the tenant-facing billing surface while PAYMENTS_ENABLED is off.
 *
 * Applied at the controller so every current and future billing endpoint is
 * covered by one decision — a new route cannot forget it. The Stripe adapter
 * refuses independently, so this is the polite answer rather than the only
 * safeguard.
 */
@Injectable()
export class PaymentsEnabledGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(): boolean {
    if (!this.config.payments.enabled) {
      throw new PaymentsDisabledError();
    }
    return true;
  }
}
