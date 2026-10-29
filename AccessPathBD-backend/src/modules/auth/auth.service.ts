import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import * as argon2 from "argon2";
import { createHash, randomBytes, randomUUID } from "crypto";
import { IsNull, MoreThan, Repository } from "typeorm";
import { appConfig } from "@/config/app.config";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { RedisCacheService } from "@/providers/cache/redis/redis-cache.service";
import { AuditService } from "@/modules/audit/audit.service";
import {
  ChangePasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from "@/modules/auth/dto/account.dto";
import { LoginDto, RegisterDto } from "@/modules/auth/dto/auth.dto";
import {
  AuthToken,
  AuthTokenType,
} from "@/modules/auth/entities/auth-token.entity";
import { blacklistKey } from "@/modules/auth/jwt.strategy";
import { MailService } from "@/modules/mail/mail.service";
import { User } from "@/modules/users/entities/user.entity";
import { toPublicUser, UsersService } from "@/modules/users/users.service";

const HOUR = 3_600_000;
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const emptyToNull = (v?: string) =>
  v === undefined ? undefined : v.trim() === "" ? null : v.trim();

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly redis: RedisCacheService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    @InjectRepository(AuthToken) private readonly tokens: Repository<AuthToken>,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const user = await this.users.createContributor({
      fullName: dto.fullName,
      email: dto.email,
      passwordHash,
      affiliation: emptyToNull(dto.affiliation) ?? null,
    });
    void this.sendVerification(user); // do not make sign-up wait for (or fail on) email
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

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const patch: Partial<User> = {};
    if (dto.fullName !== undefined) patch.fullName = dto.fullName;
    if (dto.affiliation !== undefined)
      patch.affiliation = emptyToNull(dto.affiliation);
    if (dto.institution !== undefined)
      patch.institution = emptyToNull(dto.institution);
    if (dto.phone !== undefined) patch.phone = emptyToNull(dto.phone);
    if (dto.preferredLanguage !== undefined)
      patch.preferredLanguage = dto.preferredLanguage;
    if (dto.textSize !== undefined) patch.textSize = dto.textSize;
    if (dto.highContrast !== undefined) patch.highContrast = dto.highContrast;
    if (dto.reduceMotion !== undefined) patch.reduceMotion = dto.reduceMotion;
    return this.users.updateProfile(userId, patch);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users.findForPassword(userId);
    const ok =
      user &&
      (await argon2
        .verify(user.passwordHash, dto.currentPassword)
        .catch(() => false));
    if (!ok)
      throw new BadRequestException("Your current password is incorrect");
    if (dto.currentPassword === dto.newPassword)
      throw new BadRequestException(
        "Choose a new password that is different from the current one",
      );
    await this.users.setPasswordHash(
      userId,
      await argon2.hash(dto.newPassword, { type: argon2.argon2id }),
    );
    await this.audit.log({
      actorUserId: userId,
      action: "PASSWORD_CHANGED",
      entityType: "user",
      entityId: userId,
    });
    return { message: "Password updated" };
  }


  async forgotPassword(email: string) {
    const user = await this.users.findByEmail(email);
    if (user?.isActive) {
      const token = await this.createToken(
        user.id,
        AuthTokenType.PASSWORD_RESET,
        HOUR,
      );
      await this.mail.send(
        user.email,
        "Reset your AccessPath BD password",
        `Hello ${user.fullName},\n\nUse this link to choose a new password (valid for 1 hour):\n${appConfig.env.FRONTEND_URL}/reset-password?token=${token}\n\nIf you did not ask for this, you can ignore this email: your password has not changed.`,
      );
    }
    return {
      message:
        "If an account exists for that email, a reset link has been sent.",
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const row = await this.consumeToken(
      dto.token,
      AuthTokenType.PASSWORD_RESET,
    );
    await this.users.setPasswordHash(
      row.userId,
      await argon2.hash(dto.password, { type: argon2.argon2id }),
    );
    await this.audit.log({
      actorUserId: row.userId,
      action: "PASSWORD_RESET",
      entityType: "user",
      entityId: row.userId,
    });
    return { message: "Password reset. You can now sign in." };
  }


  async sendVerification(user: User) {
    if (user.emailVerifiedAt) return;
    const token = await this.createToken(
      user.id,
      AuthTokenType.EMAIL_VERIFY,
      24 * HOUR,
    );
    await this.mail.send(
      user.email,
      "Verify your AccessPath BD email",
      `Hello ${user.fullName},\n\nConfirm your email address (valid for 24 hours):\n${appConfig.env.FRONTEND_URL}/verify-email?token=${token}`,
    );
  }

  async resendVerification(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    if (user.emailVerifiedAt)
      return { message: "Your email is already verified" };
    await this.sendVerification(user);
    return { message: "Verification email sent" };
  }

  async verifyEmail(token: string) {
    const row = await this.consumeToken(token, AuthTokenType.EMAIL_VERIFY);
    await this.users.markEmailVerified(row.userId);
    return { message: "Email verified" };
  }

  private async createToken(
    userId: string,
    type: AuthTokenType,
    ttlMs: number,
  ) {
    await this.tokens.update(
      { userId, type, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    const raw = randomBytes(32).toString("hex");
    await this.tokens.insert({
      userId,
      type,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + ttlMs),
    });
    return raw;
  }

  private async consumeToken(raw: string, type: AuthTokenType) {
    const row = await this.tokens.findOne({
      where: {
        tokenHash: sha256(raw),
        type,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    if (!row)
      throw new BadRequestException(
        "This link is invalid or has expired. Please request a new one.",
      );
    // atomic "use once": only one concurrent request can flip usedAt from NULL
    const res = await this.tokens.update(
      { id: row.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    if (!res.affected)
      throw new BadRequestException("This link has already been used.");
    return row;
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
