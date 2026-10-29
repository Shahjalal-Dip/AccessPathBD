import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { Role } from "@/common/enums/role.enum";
import { ApiProperty } from "@nestjs/swagger";

export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional() 
  @IsString() 
  @MaxLength(100) 
  search?: string;
  
  @IsOptional() 
  @IsEnum(Role) 
  role?: Role;
}
export class UpdateUserRoleDto {
  @IsEnum(Role) 
  @ApiProperty()
  role!: Role;
}
export class UpdateUserStatusDto {
  @IsBoolean()
  @ApiProperty() 
  isActive!: boolean;
}
