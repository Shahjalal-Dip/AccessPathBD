import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Role } from "@/common/enums/role.enum";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ length: 120 })
  fullName!: string;

  @Index({ unique: true })
  @Column({ length: 254 })
  email!: string;

  /** Never selected by default; load explicitly with addSelect for login. */
  @Column({ select: false })
  passwordHash!: string;

  @Column({
    type: "enum",
    enum: Role,
    enumName: "user_role",
    default: Role.CONTRIBUTOR,
  })
  role!: Role;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: "timestamptz", nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ type: "varchar", length: 160, nullable: true })
  affiliation!: string | null;

  @Column({ type: "varchar", length: 160, nullable: true })
  institution!: string | null;

  @Column({ type: "varchar", length: 30, nullable: true })
  phone!: string | null;

  /** Display and accessibility preferences (Account Settings screen) */
  @Column({ type: "varchar", length: 5, default: "en" })
  preferredLanguage!: string;

  @Column({ type: "varchar", length: 12, default: "standard" })
  textSize!: string;

  @Column({ default: false })
  highContrast!: boolean;

  @Column({ default: false })
  reduceMotion!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
