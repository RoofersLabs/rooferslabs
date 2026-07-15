import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@rooferslabs/shared';
import { ROLES_KEY } from '../constants';

/** Restricts an endpoint to users holding one of the given roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
