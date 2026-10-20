import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccountReviewsSaved1791974013278 implements MigrationInterface {
  name = "AddAccountReviewsSaved1791974013278";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "saved_buildings" ("user_id" uuid NOT NULL, "building_id" uuid NOT NULL, "saved_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d572a1ab950d14366ebf9b11686" PRIMARY KEY ("user_id", "building_id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."review_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "building_id" uuid NOT NULL, "user_id" uuid NOT NULL, "rating" smallint NOT NULL, "title" character varying(120), "body" text NOT NULL, "visit_date" date NOT NULL, "features_used" jsonb NOT NULL DEFAULT '[]', "status" "public"."review_status" NOT NULL DEFAULT 'PENDING', "moderator_note" text, "decided_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_reviews_rating" CHECK ("rating" BETWEEN 1 AND 5), CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_728447781a30bc3fcfe5c2f1cd" ON "reviews" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_451b1b80bc370d243d47e826c1" ON "reviews" ("building_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."auth_token_type" AS ENUM('PASSWORD_RESET', 'EMAIL_VERIFY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" "public"."auth_token_type" NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_41e9ddfbb32da18c4e85e45c2fd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9691367d446cd8b18f462c191b" ON "auth_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3a94cfa1eada85ac2bf6f3016b" ON "auth_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verified_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "affiliation" character varying(160)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "institution" character varying(160)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "phone" character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "preferred_language" character varying(5) NOT NULL DEFAULT 'en'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "text_size" character varying(12) NOT NULL DEFAULT 'standard'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "high_contrast" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "reduce_motion" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_buildings" ADD CONSTRAINT "FK_9e35d2f46341480a9c7b89c29fd" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_buildings" ADD CONSTRAINT "FK_361a905b82c12e42c759b6aaaca" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_784ff30ab6de68428650dbe3b5f" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_728447781a30bc3fcfe5c2f1cdf" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_tokens" ADD CONSTRAINT "FK_9691367d446cd8b18f462c191b3" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_tokens" DROP CONSTRAINT "FK_9691367d446cd8b18f462c191b3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_728447781a30bc3fcfe5c2f1cdf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_784ff30ab6de68428650dbe3b5f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_buildings" DROP CONSTRAINT "FK_361a905b82c12e42c759b6aaaca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_buildings" DROP CONSTRAINT "FK_9e35d2f46341480a9c7b89c29fd"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "reduce_motion"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "high_contrast"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "text_size"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "preferred_language"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "institution"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "affiliation"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "email_verified_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3a94cfa1eada85ac2bf6f3016b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9691367d446cd8b18f462c191b"`,
    );
    await queryRunner.query(`DROP TABLE "auth_tokens"`);
    await queryRunner.query(`DROP TYPE "public"."auth_token_type"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_451b1b80bc370d243d47e826c1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_728447781a30bc3fcfe5c2f1cd"`,
    );
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`DROP TYPE "public"."review_status"`);
    await queryRunner.query(`DROP TABLE "saved_buildings"`);
  }
}
