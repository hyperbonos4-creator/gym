import { MigrationInterface, QueryRunner } from "typeorm";

export class KioskPairing1794200000001 implements MigrationInterface {
    name = "KioskPairing1794200000001"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "kiosk_devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "gym_id" character varying(64) NOT NULL, "access_point_id" uuid NOT NULL, "token_jti" character varying(64) NOT NULL, "created_by" uuid, "last_seen_at" TIMESTAMP WITH TIME ZONE, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_kiosk_devices" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_kiosk_devices_gym" ON "kiosk_devices" ("gym_id")`);
        await queryRunner.query(`CREATE INDEX "idx_kiosk_devices_point" ON "kiosk_devices" ("access_point_id")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_kiosk_devices_jti" ON "kiosk_devices" ("token_jti")`);
        await queryRunner.query(`CREATE TABLE "kiosk_pairing_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code_hash" character varying(64) NOT NULL, "gym_id" character varying(64) NOT NULL, "access_point_id" uuid NOT NULL, "device_name" character varying(120) NOT NULL DEFAULT 'Kiosko', "created_by" uuid, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "attempt_count" integer NOT NULL DEFAULT 0, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_kiosk_pairing_codes" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_kiosk_pairing_hash" ON "kiosk_pairing_codes" ("code_hash")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_kiosk_pairing_hash"`);
        await queryRunner.query(`DROP TABLE "kiosk_pairing_codes"`);
        await queryRunner.query(`DROP INDEX "public"."idx_kiosk_devices_jti"`);
        await queryRunner.query(`DROP INDEX "public"."idx_kiosk_devices_point"`);
        await queryRunner.query(`DROP INDEX "public"."idx_kiosk_devices_gym"`);
        await queryRunner.query(`DROP TABLE "kiosk_devices"`);
    }
}
