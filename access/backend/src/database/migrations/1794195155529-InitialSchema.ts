import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1794195155529 implements MigrationInterface {
    name = 'InitialSchema1794195155529'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "first_name" character varying(100) NOT NULL, "last_name" character varying(100) NOT NULL, "role" character varying(16) NOT NULL DEFAULT 'OPERATOR', "is_active" boolean NOT NULL DEFAULT true, "demo_session_id" uuid, "last_login_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "cameras" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "rtsp_url" text NOT NULL, "external_key" character varying(120), "nvr_channel" integer, "status" character varying(12) NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_88b40b9817f9f422121f861e1e8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "access_points" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "kind" character varying(16) NOT NULL DEFAULT 'PEDESTRIAN', "camera_id" uuid, "security_level" character varying(8) NOT NULL DEFAULT 'NORMAL', "match_threshold" numeric(5,4) NOT NULL DEFAULT '0.5', "liveness_threshold" numeric(5,4) NOT NULL DEFAULT '0.7', "controller_kind" character varying(16), "controller_ref" character varying(200), "status" character varying(12) NOT NULL DEFAULT 'ACTIVE', "demo_session_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_189c2c9c92eadc0401f406f0df2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "access_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "access_point_id" uuid NOT NULL, "demo_session_id" uuid, "subject_id" uuid, "match_score" numeric(5,4), "liveness_score" numeric(5,4), "liveness_mode" character varying(8), "decision" character varying(8) NOT NULL, "reason" character varying(24) NOT NULL, "door_actuated" boolean NOT NULL DEFAULT false, "actor_id" uuid, "snapshot_url" text, "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b5edb54463ff60f59a3d40f71e3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_access_events_point" ON "access_events" ("access_point_id", "recorded_at") `);
        await queryRunner.query(`CREATE INDEX "idx_access_events_recorded" ON "access_events" ("recorded_at") `);
        await queryRunner.query(`CREATE TABLE "enrolled_subjects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "full_name" character varying(160) NOT NULL, "kind" character varying(16) NOT NULL DEFAULT 'EMPLOYEE', "employee_code" character varying(64), "status" character varying(12) NOT NULL DEFAULT 'ACTIVE', "demo_session_id" uuid, "portrait_jpeg" bytea, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_279524bc80471d3beb5501fe4ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "face_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subject_id" uuid NOT NULL, "vector_point_id" character varying(64) NOT NULL, "model" character varying(24) NOT NULL DEFAULT 'ARCFACE', "dim" smallint NOT NULL DEFAULT '512', "quality" numeric(5,4), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0a675b50a38affc9583291e69e5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_face_templates_subject" ON "face_templates" ("subject_id") `);
        await queryRunner.query(`CREATE TABLE "subject_authorizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subject_id" uuid NOT NULL, "access_point_id" uuid NOT NULL, "schedule" jsonb, "valid_until" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_28453ba0e1cef3aa0062f657591" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_subject_auth" ON "subject_authorizations" ("subject_id", "access_point_id") `);
        await queryRunner.query(`CREATE TABLE "biometric_consents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subject_id" uuid NOT NULL, "purpose" character varying(200) NOT NULL, "policy_version" character varying(32) NOT NULL, "status" character varying(12) NOT NULL DEFAULT 'ACTIVE', "granted_by" uuid, "granted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), "revoked_at" TIMESTAMP WITH TIME ZONE, "ip_address" character varying(64), "user_agent" character varying(256), "signature" text, CONSTRAINT "PK_243ef202f5ae137abae95176def" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_biometric_consents_subject" ON "biometric_consents" ("subject_id") `);
        await queryRunner.query(`CREATE TABLE "demo_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "display_name" character varying(80) NOT NULL, "access_point_id" uuid, "status" character varying(12) NOT NULL DEFAULT 'ACTIVE', "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "purged_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_8ff376e201e963a21dff19356a4" UNIQUE ("email"), CONSTRAINT "PK_c01ab53e5154479e902860654c0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_demo_sessions_expiry" ON "demo_sessions" ("status", "expires_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_demo_sessions_expiry"`);
        await queryRunner.query(`DROP TABLE "demo_sessions"`);
        await queryRunner.query(`DROP INDEX "public"."idx_biometric_consents_subject"`);
        await queryRunner.query(`DROP TABLE "biometric_consents"`);
        await queryRunner.query(`DROP INDEX "public"."uq_subject_auth"`);
        await queryRunner.query(`DROP TABLE "subject_authorizations"`);
        await queryRunner.query(`DROP INDEX "public"."idx_face_templates_subject"`);
        await queryRunner.query(`DROP TABLE "face_templates"`);
        await queryRunner.query(`DROP TABLE "enrolled_subjects"`);
        await queryRunner.query(`DROP INDEX "public"."idx_access_events_recorded"`);
        await queryRunner.query(`DROP INDEX "public"."idx_access_events_point"`);
        await queryRunner.query(`DROP TABLE "access_events"`);
        await queryRunner.query(`DROP TABLE "access_points"`);
        await queryRunner.query(`DROP TABLE "cameras"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
