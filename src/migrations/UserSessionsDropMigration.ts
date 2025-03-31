import { MigrationInterface, QueryRunner } from "typeorm";

export class UserSessionsDropMigration implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "user_sessions"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "user_sessions" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "user_id" varchar NOT NULL,
                "signature" varchar NOT NULL,
                "expires_at" timestamp NOT NULL,
                "created_at" timestamp DEFAULT now(),
                "ip_address" varchar(50),
                "user_agent" varchar,
                CONSTRAINT "fk_user_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
            )
        `);
    }
}
