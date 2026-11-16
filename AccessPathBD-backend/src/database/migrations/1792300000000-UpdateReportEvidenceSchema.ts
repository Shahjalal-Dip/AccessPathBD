
import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateReportEvidenceSchema1792300000000
  implements MigrationInterface
{
  name = "UpdateReportEvidenceSchema1792300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "report_evidence"
      RENAME COLUMN "file_name" TO "stored_filename"
    `);

    await queryRunner.query(`
      ALTER TABLE "report_evidence"
      RENAME COLUMN "original_name" TO "original_filename"
    `);

    await queryRunner.query(`
      ALTER TABLE "report_evidence"
      RENAME COLUMN "uploaded_at" TO "created_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "report_evidence"
      ALTER COLUMN "stored_filename" TYPE varchar(255),
      ALTER COLUMN "original_filename" TYPE varchar(255)
    `);

    await queryRunner.query(`
      ALTER TABLE "report_evidence"
      ADD COLUMN "uploaded_by_id" uuid NOT NULL,
      ADD COLUMN "storage_path" varchar(500) NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "report_evidence"
      ADD CONSTRAINT "UQ_report_evidence_stored_filename"
      UNIQUE ("stored_filename")
    `);

    await queryRunner.query(`
      ALTER TABLE "report_evidence"
      ADD CONSTRAINT "FK_report_evidence_uploaded_by"
      FOREIGN KEY ("uploaded_by_id")
      REFERENCES "users"("id")
      ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_report_evidence_report_created"
      ON "report_evidence" ("report_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "IDX_report_evidence_report_created"
    `);

    await queryRunner.query(`
      ALTER TABLE "report_evidence"
      DROP CONSTRAINT "FK_report_evidence_uploaded_by"
    `);

    await queryRunner.query(`
      ALTER TABLE "report_evidence"
      DROP CONSTRAINT "UQ_report_evidence_stored_filename"
    `);

    await queryRunner.query(`
      ALTER TABLE "report_evidence"
      DROP COLUMN "storage_path",
      DROP COLUMN "uploaded_by_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "report_evidence"
      ALTER COLUMN "stored_filename" TYPE varchar(80),
      ALTER COLUMN "original_filename" TYPE varchar(120)
    `);

    await queryRunner.query(`
      ALTER TABLE "report_evidence"
      RENAME COLUMN "created_at" TO "uploaded_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "report_evidence"
      RENAME COLUMN "original_filename" TO "original_name"
    `);

    await queryRunner.query(`
      ALTER TABLE "report_evidence"
      RENAME COLUMN "stored_filename" TO "file_name"
    `);
  }
}
