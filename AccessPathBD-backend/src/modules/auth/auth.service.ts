import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomUUID } from "crypto";
import { appConfig } from "@/config/app.config";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { RedisCacheService } from "@/providers/cache/redis/redis-cache.service";
import { LoginDto, RegisterDto } from "@/modules/auth/dto/auth.dto";
import { blacklistKey } from "@/modules/auth/jwt.strategy";
import { toPublicUser, UsersService } from "@/modules/users/users.service";

@Injectable()
export class AuthService {
  // Used so "unknown email" takes as long as "wrong password" (no user enumeration by timing)
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly redis: RedisCacheService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const user = await this.users.createContributor({
      fullName: dto.fullName,
      email: dto.email,
      passwordHash,
    });
    return this.issueToken(user.id, toPublicUser(user));
  }

  async login(dto: LoginDto) {
    const user = await this.users.findForLogin(dto.email);
    this.dummyHash ??= argon2.hash("dummy-password-for-timing");
    const hash = user?.passwordHash ?? (await this.dummyHash);
    const ok = await argon2.verify(hash, dto.password).catch(() => false);

    if (!user || !ok || !user.isActive)
      throw new UnauthorizedException("Invalid email or password");

    return this.issueToken(user.id, toPublicUser(user));
  }

  async logout(user: AuthUser) {
    if (!user.jti || !user.exp) return;
    const ttl = user.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0)
      await this.redis
        .getClient()
        .set(blacklistKey(user.jti), "1", { EX: ttl });
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return toPublicUser(user);
  }

  private async issueToken<T>(userId: string, user: T) {
    const accessToken = await this.jwt.signAsync({
      sub: userId,
      jti: randomUUID(),
    });
    return {
      accessToken,
      tokenType: "Bearer" as const,
      expiresIn: appConfig.env.JWT_TTL,
      user,
    };
  }
}
