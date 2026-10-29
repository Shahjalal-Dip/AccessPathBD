import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { appConfig } from "@/config/app.config";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { RedisCacheService } from "@/providers/cache/redis/redis-cache.service";
import { UsersService } from "@/modules/users/users.service";

export const blacklistKey = (jti: string) => `bl:${jti}`;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    private readonly users: UsersService,
    private readonly redis: RedisCacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: appConfig.env.JWT_BEARER_SECRET,
      algorithms: ["HS256"],
    });
  }

  async validate(payload: {
    sub: string;
    jti: string;
    exp: number;
  }): Promise<AuthUser> {
    if (!payload?.sub || !payload?.jti) throw new UnauthorizedException();

    if (await this.redis.getClient().get(blacklistKey(payload.jti)))
      throw new UnauthorizedException("Session ended. Please log in again.");

    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive)
      throw new UnauthorizedException("Account not found or deactivated");

    return {
      id: user.id,
      email: user.email,
      roles: [user.role],
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
