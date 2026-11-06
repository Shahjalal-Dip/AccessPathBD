import { Transform } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import {
  ModerationDecision,
  ModerationStatus,
} from "@/common/enums/accessibility.enums";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class DecisionDto {
  @IsIn([
    ModerationDecision.APPROVED,
    ModerationDecision.REJECTED,
    ModerationDecision.NEEDS_CLARIFICATION,
  ])
  decision!: ModerationDecision;

  @Transform(trim)
  @ValidateIf((o) => o.decision !== ModerationDecision.APPROVED)
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason?: string;
}

export class ResolveDisputeDto {
  @IsUUID() winningReportId!: string;
  @Transform(trim) @IsString() @Length(10, 1000) reason!: string;
}

export class ReviewQueueQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([...Object.values(ModerationStatus), "ALL"])
  status?: ModerationStatus | "ALL";
  @IsOptional() @IsUUID() buildingId?: string;
}
