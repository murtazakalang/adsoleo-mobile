import { Injectable, CanActivate, ExecutionContext, UnprocessableEntityException } from '@nestjs/common';
import { CreatorsService } from '../../creators/creators.service';

@Injectable()
export class RequireCompleteProfileGuard implements CanActivate {
  constructor(private creatorsService: CreatorsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Set by JwtAuthGuard

    if (!user) {
      return false;
    }

    // Admins bypass this check
    if (user.role === 'ADMIN') {
      return true;
    }

    const isComplete = await this.creatorsService.isProfileCompleteForUser(
      user.id,
    );
    if (!isComplete) {
      throw new UnprocessableEntityException('Creator profile is incomplete');
    }

    return true;
  }
}
