import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { FeatureType, ReviewStatus } from "@/common/enums/accessibility.enums";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateReviewDto {
  @Type(() => Number) 
  @IsInt() 
  @Min(1) 
  @Max(5) 
  rating!: number;

  @IsOptional() 
  @Transform(trim) 
  @IsString() 
  @MaxLength(120) 
  title?: string;

  @Transform(trim) 
  @IsString() 
  @Length(80, 2000) 
  body!: string;

  @IsDateString() 
  visitDate!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsEnum(FeatureType, { each: true })
  featuresUsed?: FeatureType[];
}

export class UpdateReviewDto {
  @IsOptional() 
  @Type(() => Number) 
  @IsInt() 
  @Min(1) 
  @Max(5) 
  rating?: number;

  @IsOptional() 
  @Transform(trim) 
  @IsString() 
  @MaxLength(120) 
  title?: string;

  @IsOptional() 
  @Transform(trim) 
  @IsString() 
  @Length(80, 2000) 
  body?: string;

  @IsOptional() 
  @IsDateString() 
  visitDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsEnum(FeatureType, { each: true })
  featuresUsed?: FeatureType[];
}

export class ListReviewsQueryDto extends PaginationQueryDto {
  @IsOptional() 
  @IsIn(["recent", "high", "low"]) 
  sort?:
    | "recent"
    | "high"
    | "low";
}

export class MyReviewsQueryDto extends PaginationQueryDto {
  @IsOptional() 
  @IsEnum(ReviewStatus) 
  status?: ReviewStatus;
}

export class ReviewQueueQueryDto extends PaginationQueryDto {
  @IsOptional() 
  @IsIn([...Object.values(ReviewStatus), "ALL"]) 
  status?:
    | ReviewStatus
    | "ALL";
  @IsOptional() 
  @IsUUID() 
  buildingId?: string;
}

export class ReviewDecisionDto {
  @IsIn([ReviewStatus.APPROVED, ReviewStatus.REJECTED]) 
  decision!: ReviewStatus;


  @Transform(trim)
  @ValidateIf((o) => o.decision === ReviewStatus.REJECTED)
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  note?: string;
}
