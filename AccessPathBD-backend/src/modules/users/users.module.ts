import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "@/modules/audit/audit.module";
import { User } from "@/modules/users/entities/user.entity";
import { UsersAdminController } from "@/modules/users/users-admin.controller";
import { UsersService } from "@/modules/users/users.service";

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuditModule],
  controllers: [UsersAdminController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
