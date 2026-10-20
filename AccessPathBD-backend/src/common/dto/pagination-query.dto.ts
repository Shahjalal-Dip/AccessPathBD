import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const skipOf = (q: PaginationQueryDto) => (q.page - 1) * q.limit;

export const paginated = <T>(
  data: T[],
  total: number,
  q: PaginationQueryDto,
): Paginated<T> => ({
  data,
  meta: {
    page: q.page,
    limit: q.limit,
    total,
    totalPages: Math.ceil(total / q.limit),
  },
});
