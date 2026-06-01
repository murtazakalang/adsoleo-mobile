import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

function makeContext(user: { role: Role } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows access when the handler has no @Roles metadata', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = makeContext({ role: Role.CREATOR });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access when user role matches required roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) =>
        key === ROLES_KEY ? [Role.ADMIN] : undefined,
      );
    const ctx = makeContext({ role: Role.ADMIN });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when user role is not in required roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) =>
        key === ROLES_KEY ? [Role.ADMIN] : undefined,
      );
    const ctx = makeContext({ role: Role.CREATOR });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user is missing on the request', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) =>
        key === ROLES_KEY ? [Role.ADMIN] : undefined,
      );
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
