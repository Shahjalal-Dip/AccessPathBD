import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsString,
  IsUUID,
  Length,
} from "class-validator";
import { REPORTABLE_STATUSES } from "@/common/enums/accessibility.enums";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateReportDto {
  @IsUUID()
  @ApiProperty({ format: "uuid" })
  buildingId!: string;

  @IsUUID()
  @ApiProperty({ format: "uuid" })
  featureId!: string;

  @IsIn(REPORTABLE_STATUSES)
  @ApiProperty({ enum: REPORTABLE_STATUSES })
  observationStatus!: (typeof REPORTABLE_STATUSES)[number];

  @IsDateString()
  @ApiProperty({ format: "date-time" })
  observedAt!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  @ApiProperty({ maxLength: 2000 })
  description!: string;
}