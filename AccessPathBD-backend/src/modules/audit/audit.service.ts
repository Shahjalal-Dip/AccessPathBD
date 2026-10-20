import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { AuditLog } from "@/modules/audit/entities/audit-log.entity";
import {
  Paginated,
  PaginationQueryDto,
  paginated,
  skipOf,
} from "@/common/dto/pagination-query.dto";

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
  ) {}

  /** Pass the transaction's EntityManager so the log commits/rolls back with the action. */
  async log(entry: AuditEntry, em?: EntityManager) {
    const repo = em ? em.getRepository(AuditLog) : this.repo;
    await repo.insert({
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: (entry.metadata ?? null) as any,
    });
  }

  async list(
    q: PaginationQueryDto,
    filter: { entityType?: string; action?: string },
  ): Promise<Paginated<AuditLog>> {
    const [rows, total] = await this.repo.findAndCount({
      where: {
        ...(filter.entityType ? { entityType: filter.entityType } : {}),
        ...(filter.action ? { action: filter.action } : {}),
      },
      order: { createdAt: "DESC" },
      skip: skipOf(q),
      take: q.limit,
    });
    return paginated(rows, total, q);
  }
}
