import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { Role } from "@/common/enums/role.enum";

export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
}
export class UpdateUserRoleDto {
  @IsEnum(Role) role!: Role;
}
export class UpdateUserStatusDto {
  @IsBoolean() isActive!: boolean;
}
