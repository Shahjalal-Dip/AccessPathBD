import { PaginationQueryDto } from "@/src/common/dto/pagination-query.dto";
import { IsOptional, IsString, MaxLength } from "class-validator";
export class AuditQueryDto extends PaginationQueryDto {
  @IsOptional() 
  @IsString() 
  @MaxLength(64) 
  entityType?: string;

  @IsOptional() 
  @IsString() 
  @MaxLength(64) 
  action?: string;
}