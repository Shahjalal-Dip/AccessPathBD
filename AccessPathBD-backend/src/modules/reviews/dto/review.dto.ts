import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { FeatureType } from "@/common/enums/accessibility.enums";

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
  @ApiPropertyOptional()
  title?: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  @ApiProperty()
  body!: string;

  @IsDateString()
  @ApiProperty({ example: "2026-11-11" })
  visitDate!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsEnum(FeatureType, { each: true })
  @ApiPropertyOptional({ enum: FeatureType, isArray: true })
  featuresUsed?: FeatureType[];
}
