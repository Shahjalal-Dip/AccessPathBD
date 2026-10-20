import { getCurrentUser } from "@/common/helpers/auth.helper";
import { IRequest } from "@/common/interfaces/request.interface";
import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const req: IRequest = context.switchToHttp().getRequest();
    const user = getCurrentUser(req);
    if (typeof user === "string") throw new UnauthorizedException(user);
    return user;
  },
);

/** Returns null instead of throwing when the request is anonymous. */
export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const req: IRequest = context.switchToHttp().getRequest();
    const user = getCurrentUser(req);
    if (typeof user === "string") return null;
    return user;
  },
);
