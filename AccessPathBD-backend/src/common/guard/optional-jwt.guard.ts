import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Authenticates when a valid token is present but never rejects anonymous
 * callers. Use together with OptionalCurrentUser for mixed public/private routes.
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard("jwt") {
  handleRequest(_err: unknown, user: any) {
    return user || null;
  }
}
