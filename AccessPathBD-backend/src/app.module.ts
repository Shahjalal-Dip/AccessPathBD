import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { BullModule } from "@nestjs/bull";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PostgresDatabaseProviderModule } from "@/providers/database/postgres/provider.module";
import { RedisCacheModule } from "@/providers/cache/redis/redis-cache.module";
import { AppController } from "@/src/app.controller";
import { AppService } from "@/src/app.service";
import { appConfig } from "@/config/app.config";
import { AuditModule } from "@/modules/audit/audit.module";
import { AuthModule } from "@/modules/auth/auth.module";
import { MailModule } from "@/modules/mail/mail.service";
import { UsersModule } from "@/modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PostgresDatabaseProviderModule,
    RedisCacheModule,
    BullModule.forRoot({ url: appConfig.env.REDIS_URL }),
    ThrottlerModule.forRoot([
      {
        ttl: appConfig.env.THROTTLE_TTL_SECONDS * 1000,
        limit: appConfig.env.THROTTLE_LIMIT,
      },
    ]),
    MailModule,
    AuditModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
