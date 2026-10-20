import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ModerationDecision } from "@/common/enums/accessibility.enums";
import { Report } from "@/modules/reports/entities/report.entity";
import { User } from "@/modules/users/entities/user.entity";

/** Append-only moderation history. Rows are never updated or deleted. */
@Entity("verifications")
export class Verification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "uuid" })
  reportId!: string;

  @ManyToOne(() => Report, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "report_id" })
  report?: Report;

  @Column({ type: "uuid" })
  reviewedById!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "reviewed_by_id" })
  reviewedBy?: User;

  @Column({
    type: "enum",
    enum: ModerationDecision,
    enumName: "moderation_decision",
  })
  decision!: ModerationDecision;

  @Column({ type: "text", nullable: true })
  decisionReason!: string | null;

  /** "reviewed_at" in the proposal. */
  @CreateDateColumn({ type: "timestamptz" })
  reviewedAt!: Date;
}
