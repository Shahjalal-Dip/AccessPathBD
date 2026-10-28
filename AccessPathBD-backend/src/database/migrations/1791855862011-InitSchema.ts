import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1791855862011 implements MigrationInterface {
  name = "InitSchema1791855862011";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" 
       AS ENUM('CONTRIBUTOR', 'MODERATOR', 'ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
      "full_name" character varying(120) NOT NULL, 
      "email" character varying(254) NOT NULL, 
      "password_hash" character varying NOT NULL, 
      "role" "public"."user_role" NOT NULL DEFAULT 'CONTRIBUTOR', 
      "is_active" boolean NOT NULL DEFAULT true, 
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
      CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."building_category" 
       AS ENUM('ACADEMIC', 'LIBRARY', 'ADMINISTRATION', 'HEALTH', 'FOOD', 'RELIGIOUS', 'SPORTS', 'RESIDENTIAL', 'TRANSPORT', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "buildings" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
      "name" character varying(200) NOT NULL, 
      "description" text, 
      "address" character varying(300) NOT NULL, 
      "category" "public"."building_category" NOT NULL DEFAULT 'OTHER', 
      "latitude" numeric(9,6), 
      "longitude" numeric(9,6), 
      "created_by_id" uuid, 
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
      CONSTRAINT "CHK_buildings_lng_range" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180), 
      CONSTRAINT "CHK_buildings_lat_range" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90), 
      CONSTRAINT "PK_bc65c1acce268c383e41a69003a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_eff730bb29eb27590788ac38a5" ON "buildings" ("category") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_d3f0a1570e23b9f88a94be87bd" ON "buildings" ("name", "address") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."feature_type" 
       AS ENUM('STEP_FREE_ENTRANCE', 'RAMP', 'LIFT', 'ACCESSIBLE_TOILET', 'ACCESSIBLE_PARKING', 'WIDE_DOORS', 'UNOBSTRUCTED_ROUTE', 'TACTILE_PAVING', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."feature_status" 
       AS ENUM('AVAILABLE', 'PARTIAL', 'UNAVAILABLE', 'UNKNOWN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."verification_status" AS 
       ENUM('UNVERIFIED', 'VERIFIED', 'STALE', 'DISPUTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "accessibility_features" (
       "id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
       "building_id" uuid NOT NULL, 
       "feature_type" "public"."feature_type" NOT NULL, 
       "status" "public"."feature_status" NOT NULL DEFAULT 'UNKNOWN', 
       "verification_status" "public"."verification_status" NOT NULL DEFAULT 'UNVERIFIED', 
       "details" text, 
       "last_observed_at" TIMESTAMP WITH TIME ZONE, 
       "last_verified_at" TIMESTAMP WITH TIME ZONE, 
       "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
       "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
       CONSTRAINT "PK_c567814ea8d68ea84de998aa37c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_db1b8f038e703ee75d40bd03a9" ON "accessibility_features" ("feature_type", "status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fbc2d6ae964299a62d5024f826" ON "accessibility_features" ("building_id", "feature_type") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."observation_status" 
       AS ENUM('AVAILABLE', 'PARTIAL', 'UNAVAILABLE', 'UNKNOWN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."moderation_status" 
       AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_CLARIFICATION', 'WITHDRAWN', 'SUPERSEDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reports" (
       "id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
       "building_id" uuid NOT NULL, 
       "feature_id" uuid NOT NULL, 
       "submitted_by_id" uuid NOT NULL, 
       "observation_status" "public"."observation_status" NOT NULL, 
       "description" text NOT NULL, 
       "observed_at" TIMESTAMP WITH TIME ZONE NOT NULL, 
       "moderation_status" "public"."moderation_status" NOT NULL DEFAULT 'PENDING', 
       "decided_at" TIMESTAMP WITH TIME ZONE, 
       "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
       "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
       CONSTRAINT "CHK_reports_observation_not_unknown" CHECK ("observation_status" <> 'UNKNOWN'), 
       CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f3c3da90070b6d296e1bef19e5" ON "reports" ("submitted_by_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bfd3c2e6ada89023b0056fbeb9" ON "reports" ("building_id", "moderation_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0ff02f1ed354690ac8ef3d7a5f" ON "reports" ("moderation_status", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2178b223187c00bc9590947ec8" ON "reports" ("feature_id", "moderation_status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "report_evidence" (
       "id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
       "report_id" uuid NOT NULL, 
       "file_name" character varying(80) NOT NULL, 
       "original_name" character varying(120) NOT NULL, 
       "mime_type" character varying(40) NOT NULL, 
       "size_bytes" integer NOT NULL, 
       "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
       CONSTRAINT "PK_80034d7b5ae16baaee975e041ba" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a0a45277a6df8b2a29484d50f6" ON "report_evidence" ("report_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."moderation_decision" 
       AS ENUM('APPROVED', 'REJECTED', 'NEEDS_CLARIFICATION', 'SUPERSEDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "verifications" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
      "report_id" uuid NOT NULL, 
      "reviewed_by_id" uuid NOT NULL, 
      "decision" "public"."moderation_decision" NOT NULL, 
      "decision_reason" text, 
      "reviewed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
      CONSTRAINT "PK_2127ad1b143cf012280390b01d1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8bee728e01d2277c828c8468a1" ON "verifications" ("report_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" (
       "id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
       "actor_user_id" uuid, 
       "action" character varying(64) NOT NULL, 
       "entity_type" character varying(64) NOT NULL, 
       "entity_id" character varying(64), 
       "metadata" jsonb, 
       "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
       CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2cd10fda8276bb995288acfbfb" ON "audit_logs" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7421efc125d95e413657efa3c6" ON "audit_logs" ("entity_type", "entity_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "buildings" ADD CONSTRAINT "FK_6eba9fd8a44d16aeccd7e90f9a1" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "accessibility_features" ADD CONSTRAINT "FK_1633632d583f7d3324f342219bd" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_87ccfaa8a1f51b9579ce7cb7e69" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_281d18e6695ad60d1a575772c11" FOREIGN KEY ("feature_id") REFERENCES "accessibility_features"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_f3c3da90070b6d296e1bef19e56" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_evidence" ADD CONSTRAINT "FK_a0a45277a6df8b2a29484d50f6d" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "verifications" ADD CONSTRAINT "FK_8bee728e01d2277c828c8468a16" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "verifications" ADD CONSTRAINT "FK_aa21e27e4785b85202aa4f5db82" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_f160d97a931844109de9d04228f" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_f160d97a931844109de9d04228f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "verifications" DROP CONSTRAINT "FK_aa21e27e4785b85202aa4f5db82"`,
    );
    await queryRunner.query(
      `ALTER TABLE "verifications" DROP CONSTRAINT "FK_8bee728e01d2277c828c8468a16"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report_evidence" DROP CONSTRAINT "FK_a0a45277a6df8b2a29484d50f6d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_f3c3da90070b6d296e1bef19e56"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_281d18e6695ad60d1a575772c11"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_87ccfaa8a1f51b9579ce7cb7e69"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accessibility_features" DROP CONSTRAINT "FK_1633632d583f7d3324f342219bd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "buildings" DROP CONSTRAINT "FK_6eba9fd8a44d16aeccd7e90f9a1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7421efc125d95e413657efa3c6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2cd10fda8276bb995288acfbfb"`,
    );
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8bee728e01d2277c828c8468a1"`,
    );
    await queryRunner.query(`DROP TABLE "verifications"`);
    await queryRunner.query(`DROP TYPE "public"."moderation_decision"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a0a45277a6df8b2a29484d50f6"`,
    );
    await queryRunner.query(`DROP TABLE "report_evidence"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2178b223187c00bc9590947ec8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0ff02f1ed354690ac8ef3d7a5f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bfd3c2e6ada89023b0056fbeb9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f3c3da90070b6d296e1bef19e5"`,
    );
    await queryRunner.query(`DROP TABLE "reports"`);
    await queryRunner.query(`DROP TYPE "public"."moderation_status"`);
    await queryRunner.query(`DROP TYPE "public"."observation_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fbc2d6ae964299a62d5024f826"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_db1b8f038e703ee75d40bd03a9"`,
    );
    await queryRunner.query(`DROP TABLE "accessibility_features"`);
    await queryRunner.query(`DROP TYPE "public"."verification_status"`);
    await queryRunner.query(`DROP TYPE "public"."feature_status"`);
    await queryRunner.query(`DROP TYPE "public"."feature_type"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d3f0a1570e23b9f88a94be87bd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_eff730bb29eb27590788ac38a5"`,
    );
    await queryRunner.query(`DROP TABLE "buildings"`);
    await queryRunner.query(`DROP TYPE "public"."building_category"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
  }
}
