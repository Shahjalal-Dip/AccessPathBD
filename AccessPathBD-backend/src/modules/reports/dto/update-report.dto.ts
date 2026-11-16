
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from "class-validator";

import { REPORTABLE_STATUSES } from "@/common/enums/accessibility.enums";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class UpdateReportDto {
  @IsOptional()
  @IsIn(REPORTABLE_STATUSES)
  @ApiPropertyOptional({ enum: REPORTABLE_STATUSES })
  observationStatus?: (typeof REPORTABLE_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ format: "date-time" })
  observedAt?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  @ApiPropertyOptional({ maxLength: 2000 })
  description?: string;
}
