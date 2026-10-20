import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { appConfig } from "@/config/app.config";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { JwtGuard } from "@/common/guard";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { AuthService } from "@/modules/auth/auth.service";
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
  VerifyEmailDto,
} from "@/modules/auth/dto/account.dto";
import { LoginDto, RegisterDto } from "@/modules/auth/dto/auth.dto";

// Stricter limit on credential endpoints to slow brute-force attempts
const authThrottle = {
  default: { limit: appConfig.env.AUTH_THROTTLE_LIMIT, ttl: 60_000 },
};

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle(authThrottle)
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Throttle(authThrottle)
  @HttpCode(200)
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @HttpCode(200)
  @Post("logout")
  async logout(@CurrentUser() user: AuthUser) {
    await this.auth.logout(user);
    return { message: "Logged out" };
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  // ---- account settings
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Patch("profile")
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.id, dto);
  }

  @Throttle(authThrottle)
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @HttpCode(200)
  @Post("change-password")
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user.id, dto);
  }

  // ---- password reset (public)
  @Throttle(authThrottle)
  @HttpCode(200)
  @Post("forgot-password")
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Throttle(authThrottle)
  @HttpCode(200)
  @Post("reset-password")
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  // ---- email verification
  @Throttle(authThrottle)
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @HttpCode(200)
  @Post("resend-verification")
  resend(@CurrentUser() user: AuthUser) {
    return this.auth.resendVerification(user.id);
  }

  @Throttle(authThrottle)
  @HttpCode(200)
  @Post("verify-email")
  verify(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }
}
