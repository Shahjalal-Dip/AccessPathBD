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
import { ApiProperty } from "@nestjs/swagger";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateReportDto {
  @IsUUID() 
  @ApiProperty()
  buildingId!: string;

  @IsEnum(FeatureType) 
  @ApiProperty()
  featureType!: FeatureType;

  @IsIn(REPORTABLE_STATUSES as unknown as string[])
  @ApiProperty()
  observationStatus!: FeatureStatus;

  @Transform(trim) 
  @IsString() 
  @Length(10, 2000) 
  @ApiProperty()
  description!: string;

  @IsDateString() 
  @ApiProperty()
  observedAt!: string;
}

export class UpdateReportDto {
  @IsOptional()
  @ApiProperty()
  @IsIn(REPORTABLE_STATUSES as unknown as string[])
  observationStatus?: FeatureStatus;

  @IsOptional()
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(10, 2000)
  description?: string;

  @IsOptional() 
  @ApiProperty()
  @IsDateString() 
  observedAt?: string;
}

export class ListMyReportsQueryDto extends PaginationQueryDto {
  @IsOptional() 
  @ApiProperty()
  @IsEnum(ModerationStatus) 
  status?: ModerationStatus;
}

export class HistoryQueryDto extends PaginationQueryDto {
  @IsOptional() 
  @ApiProperty()
  @IsEnum(FeatureType) 
  featureType?: FeatureType;
}
