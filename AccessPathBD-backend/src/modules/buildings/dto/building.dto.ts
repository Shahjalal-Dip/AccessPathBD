import { PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import {
  BuildingCategory,
  FeatureStatus,
  FeatureType,
  VerificationStatus,
} from "@/common/enums/accessibility.enums";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateBuildingDto {
  @Transform(trim) 
  @IsString() 
  @Length(2, 200) 
  name!: string;

  @Transform(trim) 
  @IsString() 
  @Length(3, 300) 
  address!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional() 
  @IsEnum(BuildingCategory) 
  category?: BuildingCategory;

  @IsOptional() 
  @Type(() => Number) 
  @IsNumber() 
  @IsLatitude() 
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude?: number;
}

export class UpdateBuildingDto extends PartialType(CreateBuildingDto) {}

export class ListBuildingsQueryDto extends PaginationQueryDto {
  @IsOptional() 
  @Transform(trim) 
  @IsString() 
  @MaxLength(100) 
  search?: string;

  @IsOptional() 
  @IsEnum(BuildingCategory) 
  category?: BuildingCategory;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string"
      ? value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayMaxSize(9)
  @IsEnum(FeatureType, { each: true })
  features?: FeatureType[];

  @IsOptional()
  @IsIn([
    FeatureStatus.AVAILABLE,
    FeatureStatus.PARTIAL,
    FeatureStatus.UNAVAILABLE,
  ])
  featureStatus?: FeatureStatus;


  @IsOptional() 
  @IsEnum(VerificationStatus) 
  verification?: VerificationStatus;

  @IsOptional() 
  @IsIn(["name", "createdAt", "updatedAt"]) 
  sortBy?:
    | "name"
    | "createdAt"
    | "updatedAt";
    
  @IsOptional() 
  @IsIn(["ASC", "DESC"]) 
  order?: "ASC" | "DESC";
}
