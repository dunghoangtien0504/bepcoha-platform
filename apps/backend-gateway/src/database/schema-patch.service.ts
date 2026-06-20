import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes, Sequelize } from 'sequelize';
import { AppLoggerService } from '../common/logger/app-logger.service';
import { AppConfig } from '../config/configuration';

interface ColumnPatch {
  table: string;
  column: string;
  /** Mệnh đề kiểu + ràng buộc dùng cho ADD COLUMN. */
  definition: string;
}

interface ColumnRetype {
  table: string;
  column: string;
  /** Kiểu dữ liệu mong muốn (chuỗi con xuất hiện trong COLUMN_TYPE để so khớp). */
  expectedTypeContains: string;
  /** Mệnh đề MODIFY COLUMN đầy đủ. */
  modifyClause: string;
}

/**
 * Sequelize synchronize chỉ tạo bảng mới (CREATE TABLE IF NOT EXISTS), KHÔNG ALTER bảng đã tồn tại.
 * Service này vá schema một cách idempotent: thêm cột còn thiếu & đổi kiểu cột khi cần.
 * Chạy khi DB_SYNC=true, sau khi Sequelize đã đồng bộ bảng.
 */
@Injectable()
export class SchemaPatchService implements OnModuleInit {
  private readonly columnPatches: ReadonlyArray<ColumnPatch> = [
    {
      table: 'ai_request_audit_logs',
      column: 'source',
      definition: "VARCHAR(20) NOT NULL DEFAULT 'GATEWAY'",
    },
    {
      table: 'ai_request_audit_logs',
      column: 'capture_mode',
      definition: 'VARCHAR(20) NULL',
    },
    // Ngữ cảnh governance bắt từ IDE/extension (X-Project-ID, X-Conversation-ID) + metric đầu vào.
    { table: 'ai_request_audit_logs', column: 'project_id', definition: 'VARCHAR(100) NULL' },
    { table: 'ai_request_audit_logs', column: 'conversation_id', definition: 'VARCHAR(100) NULL' },
    { table: 'ai_request_audit_logs', column: 'message_count', definition: 'INT NULL' },
    { table: 'ai_request_audit_logs', column: 'request_bytes', definition: 'INT NULL' },
    { table: 'projects', column: 'owner_id', definition: 'CHAR(36) NULL' },
    { table: 'projects', column: 'created_by_id', definition: 'CHAR(36) NULL' },
    { table: 'ai_tasks', column: 'assignee_id', definition: 'CHAR(36) NULL' },
    { table: 'users', column: 'report_to_id', definition: 'CHAR(36) NULL' },
    // Cột mở rộng cho bảng projects đã tồn tại (module Quản lý Dự án mới).
    { table: 'projects', column: 'project_category_id', definition: 'INT NULL' },
    { table: 'projects', column: 'code', definition: 'VARCHAR(50) NULL' },
    { table: 'projects', column: 'title', definition: 'VARCHAR(150) NULL' },
    { table: 'projects', column: 'slug', definition: 'VARCHAR(180) NULL' },
    { table: 'projects', column: 'start_date', definition: 'DATETIME NULL' },
    { table: 'projects', column: 'end_date', definition: 'DATETIME NULL' },
    { table: 'projects', column: 'actual_completed_date', definition: 'DATETIME NULL' },
    { table: 'projects', column: 'progress', definition: 'DECIMAL(5,2) NOT NULL DEFAULT 0' },
    {
      table: 'projects',
      column: 'status',
      definition: "VARCHAR(20) NOT NULL DEFAULT 'draft'",
    },
    { table: 'projects', column: 'updated_at', definition: 'DATETIME NULL' },
    { table: 'projects', column: 'created_by', definition: 'CHAR(36) NULL' },
    { table: 'projects', column: 'updated_by', definition: 'CHAR(36) NULL' },
    { table: 'projects', column: 'actual_completed_date', definition: 'DATETIME NULL' },
    // ai_tasks: liên kết task con người + ngày phải hoàn thành + mã đối chiếu ngoài.
    { table: 'ai_tasks', column: 'task_id', definition: 'INT NULL' },
    { table: 'ai_tasks', column: 'end_date', definition: 'DATETIME NULL' },
    { table: 'ai_tasks', column: 'external_ref', definition: 'VARCHAR(100) NULL' },
    { table: 'ai_tasks', column: 'budget_tokens', definition: 'INT NULL' },
    { table: 'ai_tasks', column: 'more_desc', definition: 'TEXT NULL' },
    // tasks: trường mở rộng phục vụ giao việc cho AI & theo dõi tiến độ.
    { table: 'tasks', column: 'parent_id', definition: 'INT NULL' },
    { table: 'tasks', column: 'estimated_hours', definition: 'DECIMAL(6,2) NULL' },
    {
      table: 'tasks',
      column: 'progress_percent',
      definition: 'DECIMAL(5,2) NOT NULL DEFAULT 0',
    },
    {
      table: 'tasks',
      column: 'progress_source',
      definition: "VARCHAR(20) NOT NULL DEFAULT 'manual'",
    },
    { table: 'tasks', column: 'completed_date', definition: 'DATETIME NULL' },
    { table: 'tasks', column: 'closed_date', definition: 'DATETIME NULL' },
    { table: 'tasks', column: 'cancelled_date', definition: 'DATETIME NULL' },
    { table: 'tasks', column: 'archived_date', definition: 'DATETIME NULL' },
  ];

  private readonly columnRetypes: ReadonlyArray<ColumnRetype> = [
    {
      table: 'user_token_quotas',
      column: 'user_id',
      expectedTypeContains: 'char(36)',
      modifyClause: 'MODIFY COLUMN `user_id` CHAR(36) NOT NULL',
    },
    {
      // setting_value: nâng từ VARCHAR(255) -> TEXT để chứa cấu hình JSON lớn (policy).
      table: 'system_settings',
      column: 'setting_value',
      expectedTypeContains: 'text',
      modifyClause: 'MODIFY COLUMN `setting_value` TEXT NOT NULL',
    },
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {
    this.logger.setContext(SchemaPatchService.name);
  }

  async onModuleInit(): Promise<void> {
    const app = this.configService.getOrThrow<AppConfig>('app');
    if (!app.dbSync) return;

    try {
      // Migration một lần: đổi ai_tasks.id (và audit.task_id) sang CHAR(36) UUID.
      await this.migrateAiTaskIdToUuid();
      for (const patch of this.columnPatches) {
        await this.addColumnIfMissing(patch);
      }
      for (const retype of this.columnRetypes) {
        await this.retypeColumnIfNeeded(retype);
      }
      this.logger.logBusiness(SchemaPatchService.name, 'Vá schema (ALTER idempotent) hoàn tất');
    } catch (error) {
      this.logger.error('Vá schema thất bại', (error as Error).stack);
    }
  }

  /**
   * Migration một lần (idempotent theo kiểu cột): khi ai_tasks.id còn là VARCHAR (mã ngoài cũ),
   * chuyển sang CHAR(36) để dùng UUID tự sinh. Vì đổi kiểu khóa chính + khóa ngoại nên phải:
   * tháo FK, truncate cả hai bảng (dữ liệu demo cũ bỏ đi), MODIFY cột, gắn lại FK.
   * Lần boot sau cột đã là char(36) → bỏ qua, không xóa dữ liệu người dùng tạo.
   */
  private async migrateAiTaskIdToUuid(): Promise<void> {
    const idInfo = await this.columnInfo('ai_tasks', 'id');
    if (!idInfo) return; // Bảng chưa tồn tại — synchronize sẽ tạo đúng kiểu UUID.
    if (idInfo.COLUMN_TYPE.toLowerCase().includes('char(36)')) return; // Đã migrate.

    const fkRows = await this.sequelize.query<{ CONSTRAINT_NAME: string }>(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_request_audit_logs'
         AND COLUMN_NAME = 'task_id' AND REFERENCED_TABLE_NAME = 'ai_tasks'`,
      { type: QueryTypes.SELECT },
    );

    await this.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const fk of fkRows) {
        await this.sequelize.query(
          `ALTER TABLE \`ai_request_audit_logs\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``,
        );
      }
      await this.sequelize.query('TRUNCATE TABLE `ai_request_audit_logs`');
      await this.sequelize.query('TRUNCATE TABLE `ai_tasks`');
      await this.sequelize.query('ALTER TABLE `ai_tasks` MODIFY COLUMN `id` CHAR(36) NOT NULL');
      await this.sequelize.query(
        'ALTER TABLE `ai_request_audit_logs` MODIFY COLUMN `task_id` CHAR(36) NOT NULL',
      );
      await this.sequelize.query(
        `ALTER TABLE \`ai_request_audit_logs\`
         ADD CONSTRAINT \`fk_audit_task_id\` FOREIGN KEY (\`task_id\`) REFERENCES \`ai_tasks\` (\`id\`)`,
      );
    } finally {
      await this.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    this.logger.logBusiness(SchemaPatchService.name, 'Đã migrate ai_tasks.id → CHAR(36) UUID', {
      from: idInfo.COLUMN_TYPE,
    });
  }

  private async columnInfo(
    table: string,
    column: string,
  ): Promise<{ COLUMN_TYPE: string } | undefined> {
    const rows = await this.sequelize.query<{ COLUMN_TYPE: string }>(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
      { type: QueryTypes.SELECT, replacements: { table, column } },
    );
    return rows[0];
  }

  private async addColumnIfMissing(patch: ColumnPatch): Promise<void> {
    const info = await this.columnInfo(patch.table, patch.column);
    if (info) return;
    await this.sequelize.query(
      `ALTER TABLE \`${patch.table}\` ADD COLUMN \`${patch.column}\` ${patch.definition}`,
    );
    this.logger.logBusiness(SchemaPatchService.name, 'Đã thêm cột còn thiếu', {
      table: patch.table,
      column: patch.column,
    });
  }

  private async retypeColumnIfNeeded(retype: ColumnRetype): Promise<void> {
    const info = await this.columnInfo(retype.table, retype.column);
    if (!info) return; // Cột chưa tồn tại (bảng mới) — synchronize đã tạo đúng kiểu.
    if (info.COLUMN_TYPE.toLowerCase().includes(retype.expectedTypeContains.toLowerCase())) return;
    await this.sequelize.query(`ALTER TABLE \`${retype.table}\` ${retype.modifyClause}`);
    this.logger.logBusiness(SchemaPatchService.name, 'Đã đổi kiểu cột', {
      table: retype.table,
      column: retype.column,
      from: info.COLUMN_TYPE,
      to: retype.expectedTypeContains,
    });
  }
}
