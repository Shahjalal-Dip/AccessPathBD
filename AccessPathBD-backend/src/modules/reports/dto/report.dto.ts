import { Transform } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from "class-validator";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import {
  FeatureStatus,
  FeatureType,
  ModerationStatus,
  REPORTABLE_STATUSES,
} from "@/common/enums/accessibility.enums";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateReportDto {
  @IsUUID() buildingId!: string;
  @IsEnum(FeatureType) featureType!: FeatureType;

  @IsIn(REPORTABLE_STATUSES as unknown as string[])
  observationStatus!: FeatureStatus;

  @Transform(trim) @IsString() @Length(10, 2000) description!: string;

  /** ISO 8601 date or datetime of when the condition was actually observed. */
  @IsDateString() observedAt!: string;
}

export class UpdateReportDto {
  @IsOptional()
  @IsIn(REPORTABLE_STATUSES as unknown as string[])
  observationStatus?: FeatureStatus;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(10, 2000)
  description?: string;
  @IsOptional() @IsDateString() observedAt?: string;
}

export class ListMyReportsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(ModerationStatus) status?: ModerationStatus;
}

export class HistoryQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(FeatureType) featureType?: FeatureType;
}
