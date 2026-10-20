import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiBody} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { appConfig } from "@/config/app.config";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { JwtGuard } from "@/common/guard";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { AuthService } from "@/modules/auth/auth.service";
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
  @ApiBody({ type: RegisterDto }) 
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Throttle(authThrottle)
  @HttpCode(200)
  @Post("login")
  @ApiBody({ type: LoginDto }) 
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
}
