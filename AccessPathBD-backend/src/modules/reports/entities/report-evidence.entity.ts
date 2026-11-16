
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
import { User } from "@/modules/users/entities/user.entity";

@Entity("report_evidence")
@Index(["reportId", "createdAt"])
export class ReportEvidence {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", name: "report_id" })
  reportId!: string;

  @ManyToOne(() => Report, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "report_id" })
  report?: Report;

  @Column({ type: "uuid", name: "uploaded_by_id" })
  uploadedById!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "uploaded_by_id" })
  uploadedBy?: User;

  @Column({
    type: "varchar",
    length: 255,
    name: "original_filename",
  })
  originalFilename!: string;

  @Column({
    type: "varchar",
    length: 255,
    unique: true,
    name: "stored_filename",
  })
  storedFilename!: string;

  @Column({
    type: "varchar",
    length: 500,
    name: "storage_path",
  })
  storagePath!: string;

  @Column({
    type: "varchar",
    length: 50,
    name: "mime_type",
  })
  mimeType!: string;

  @Column({ type: "integer", name: "size_bytes" })
  sizeBytes!: number;

  @CreateDateColumn({
    type: "timestamptz",
    name: "created_at",
  })
  createdAt!: Date;
}
