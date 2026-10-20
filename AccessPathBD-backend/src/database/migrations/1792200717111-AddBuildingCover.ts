import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBuildingCover1792200717111 implements MigrationInterface {
    name = 'AddBuildingCover1792200717111'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "buildings" ADD "cover_image" character varying(80)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "buildings" DROP COLUMN "cover_image"`);
    }

}
