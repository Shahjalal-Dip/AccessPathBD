import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Report } from "@/modules/reports/entities/report.entity";

@Entity("report_evidence")
export class ReportEvidence {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "uuid" })
  reportId!: string;

  @ManyToOne(() => Report, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "report_id" })
  report?: Report;

  @Column({ length: 80 })
  fileName!: string;

  @Column({ length: 120 })
  originalName!: string;

  @Column({ length: 40 })
  mimeType!: string;

  @Column({ type: "int" })
  sizeBytes!: number;

  @CreateDateColumn({ type: "timestamptz" })
  uploadedAt!: Date;
}
