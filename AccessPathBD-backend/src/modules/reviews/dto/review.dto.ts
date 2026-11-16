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
import { ApiProperty } from "@nestjs/swagger";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateReviewDto {
  @Type(() => Number) 
  @IsInt() 
  @Min(1) 
  @Max(5) 
  @ApiProperty()
  rating!: number;

  @IsOptional() 
  @Transform(trim) 
  @IsString() 
  @MaxLength(120) 
  @ApiProperty()
  title?: string;

  @Transform(trim) 
  @IsString() 
  @Length(80, 2000) 
  @ApiProperty()
  body!: string;

  @IsDateString()
  @ApiProperty() 
  visitDate!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsEnum(FeatureType, { each: true })
  @ApiProperty()
  featuresUsed?: FeatureType[];
}

export class UpdateReviewDto {
  @IsOptional() 
  @Type(() => Number) 
  @IsInt() 
  @Min(1) 
  @Max(5) 
  @ApiProperty()
  rating?: number;

  @IsOptional() 
  @Transform(trim) 
  @IsString() 
  @MaxLength(120) 
  @ApiProperty()
  title?: string;

  @IsOptional() 
  @Transform(trim) 
  @IsString() 
  @Length(80, 2000) 
  @ApiProperty()
  body?: string;

  @IsOptional() 
  @IsDateString() 
  @ApiProperty()
  visitDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsEnum(FeatureType, { each: true })
  @ApiProperty()
  featuresUsed?: FeatureType[];
}

export class ListReviewsQueryDto extends PaginationQueryDto {
  @IsOptional() 
  @ApiProperty()
  @IsIn(["recent", "high", "low"]) 
  sort?:
    | "recent"
    | "high"
    | "low";
}

export class MyReviewsQueryDto extends PaginationQueryDto {
  @IsOptional() 
  @ApiProperty()
  @IsEnum(ReviewStatus) 
  status?: ReviewStatus;
}

export class ReviewQueueQueryDto extends PaginationQueryDto {
  @IsOptional() 
  @ApiProperty()
  @IsIn([...Object.values(ReviewStatus), "ALL"]) 
  status?:
    | ReviewStatus
    | "ALL";
    
  @IsOptional() 
  @IsUUID() 
  @ApiProperty()
  buildingId?: string;
}

export class ReviewDecisionDto {
  @ApiProperty()
  @IsIn([ReviewStatus.APPROVED, ReviewStatus.REJECTED]) 
  decision!: ReviewStatus;


  @Transform(trim)
  @ValidateIf((o) => o.decision === ReviewStatus.REJECTED)
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  @ApiProperty()
  note?: string;
}
