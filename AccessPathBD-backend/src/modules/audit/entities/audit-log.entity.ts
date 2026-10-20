import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "@/modules/users/entities/user.entity";

/** Append-only. Never store passwords, tokens or other secrets in metadata. */
@Entity("audit_logs")
@Index(["entityType", "entityId"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", nullable: true })
  actorUserId!: string | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "actor_user_id" })
  actor?: User | null;

  @Column({ length: 64 })
  action!: string;

  @Column({ length: 64 })
  entityType!: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  entityId!: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
