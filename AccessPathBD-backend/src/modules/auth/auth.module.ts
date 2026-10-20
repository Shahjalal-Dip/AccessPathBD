import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { appConfig } from "@/config/app.config";
import { AuthController } from "@/modules/auth/auth.controller";
import { AuthService } from "@/modules/auth/auth.service";
import { JwtStrategy } from "@/modules/auth/jwt.strategy";
import { UsersModule } from "@/modules/users/users.module";

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: appConfig.env.JWT_BEARER_SECRET,
      signOptions: { algorithm: "HS256", expiresIn: appConfig.env.JWT_TTL },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
