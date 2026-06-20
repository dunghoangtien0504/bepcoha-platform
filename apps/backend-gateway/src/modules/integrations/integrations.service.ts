import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { IncomingHttpHeaders } from 'http';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { decryptSecret, encryptSecret } from '../../common/utils/crypto.util';
import { AppConfig } from '../../config/configuration';
import {
  AiTaskEntity,
  IntegrationConnectionEntity,
  IntegrationProvider,
} from '../../database/models';
import { CreateConnectionDto, UpdateConnectionDto } from './dto/integration.dto';
import { ExternalTask } from './providers/pm-provider.interface';
import { PmProviderRegistry } from './providers/pm-provider.registry';

export interface SyncResult {
  connectionId: number;
  provider: IntegrationProvider;
  fetched: number;
  created: number;
  updated: number;
}

interface PublicConnection {
  id: number;
  provider: IntegrationProvider;
  name: string;
  baseUrl: string;
  externalProjectKey: string | null;
  authEmail: string | null;
  targetProjectId: number | null;
  defaultBaselineHours: number;
  isActive: boolean;
  hasWebhookSecret: boolean;
  lastSyncedAt: Date | null;
}

@Injectable()
export class IntegrationsService {
  private readonly credentialSecret: string;

  constructor(
    private readonly providerRegistry: PmProviderRegistry,
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
    @InjectModel(IntegrationConnectionEntity)
    private readonly connectionModel: typeof IntegrationConnectionEntity,
    @InjectModel(AiTaskEntity) private readonly taskModel: typeof AiTaskEntity,
  ) {
    this.logger.setContext(IntegrationsService.name);
    this.credentialSecret = this.configService.getOrThrow<AppConfig>('app').credentialSecret;
  }

  async list(): Promise<PublicConnection[]> {
    const rows = await this.connectionModel.findAll({ order: [['id', 'DESC']] });
    return rows.map((row) => this.toPublic(row));
  }

  async create(dto: CreateConnectionDto): Promise<PublicConnection> {
    const created = await this.connectionModel.create({
      provider: dto.provider,
      name: dto.name,
      baseUrl: dto.baseUrl.replace(/\/$/, ''),
      externalProjectKey: dto.externalProjectKey ?? null,
      authEmail: dto.authEmail ?? null,
      encryptedToken: encryptSecret(dto.token, this.credentialSecret),
      webhookSecret: dto.webhookSecret ?? null,
      targetProjectId: dto.targetProjectId ?? null,
      defaultBaselineHours: dto.defaultBaselineHours ?? 8,
      isActive: true,
    } as IntegrationConnectionEntity);
    this.logger.logBusiness(IntegrationsService.name, 'Tạo kết nối tích hợp', {
      provider: dto.provider,
      name: dto.name,
    });
    return this.toPublic(created);
  }

  async update(id: number, dto: UpdateConnectionDto): Promise<PublicConnection> {
    const connection = await this.getOrThrow(id);
    const patch: Partial<IntegrationConnectionEntity> = {
      name: dto.name ?? connection.name,
      baseUrl: dto.baseUrl ? dto.baseUrl.replace(/\/$/, '') : connection.baseUrl,
      externalProjectKey: dto.externalProjectKey ?? connection.externalProjectKey,
      authEmail: dto.authEmail ?? connection.authEmail,
      webhookSecret: dto.webhookSecret ?? connection.webhookSecret,
      targetProjectId: dto.targetProjectId ?? connection.targetProjectId,
      defaultBaselineHours: dto.defaultBaselineHours ?? connection.defaultBaselineHours,
      isActive: dto.isActive ?? connection.isActive,
    };
    if (dto.token) {
      patch.encryptedToken = encryptSecret(dto.token, this.credentialSecret);
    }
    await connection.update(patch);
    return this.toPublic(connection);
  }

  async remove(id: number): Promise<void> {
    const removed = await this.connectionModel.destroy({ where: { id } });
    if (!removed) throw new NotFoundException('Không tìm thấy kết nối tích hợp');
  }

  /**
   * Đồng bộ kéo (pull): lấy issue/task từ hệ thống bên thứ ba và upsert vào ai_tasks.
   */
  async sync(id: number): Promise<SyncResult> {
    const connection = await this.getOrThrow(id);
    const provider = this.providerRegistry.get(connection.provider);
    const token = decryptSecret(connection.encryptedToken, this.credentialSecret);

    const tasks = await provider.fetchTasks({ entity: connection, token });
    let created = 0;
    let updated = 0;
    for (const task of tasks) {
      const result = await this.upsertExternalTask(connection, task);
      result.created ? created++ : updated++;
    }

    await connection.update({ lastSyncedAt: new Date() });
    this.logger.logBusiness(IntegrationsService.name, 'Đồng bộ tích hợp hoàn tất', {
      connectionId: id,
      fetched: tasks.length,
      created,
      updated,
    });
    return { connectionId: id, provider: connection.provider, fetched: tasks.length, created, updated };
  }

  /**
   * Xử lý webhook đẩy (push) từ hệ thống bên thứ ba: verify chữ ký rồi upsert 1 task.
   */
  async handleWebhook(
    id: number,
    rawBody: string,
    headers: IncomingHttpHeaders,
    payload: Record<string, unknown>,
  ): Promise<{ accepted: boolean; taskId?: string }> {
    const connection = await this.getOrThrow(id);
    const provider = this.providerRegistry.get(connection.provider);

    if (!provider.verifyWebhook(connection, rawBody, headers)) {
      this.logger.warn(`Webhook chữ ký không hợp lệ cho connection ${id}`);
      return { accepted: false };
    }

    const task = provider.parseWebhook(payload);
    if (!task) return { accepted: true };

    const upserted = await this.upsertExternalTask(connection, task);
    return { accepted: true, taskId: upserted.entity.id };
  }

  /**
   * Upsert ai_tasks theo mã đối chiếu ngoài (external_source + external_ref). id là UUID tự sinh
   * — dùng làm X-Task-ID. Trả về bản ghi cùng cờ created (true nếu vừa tạo mới).
   */
  private async upsertExternalTask(
    connection: IntegrationConnectionEntity,
    task: ExternalTask,
  ): Promise<{ entity: AiTaskEntity; created: boolean }> {
    const existing = await this.taskModel.findOne({
      where: { externalSource: connection.provider, externalRef: task.externalId },
    });
    if (existing) {
      await existing.update({
        title: task.title,
        status: task.status,
        externalUrl: task.url,
        projectId: connection.targetProjectId ?? existing.projectId,
      });
      return { entity: existing, created: false };
    }
    const entity = await this.taskModel.create({
      projectId: connection.targetProjectId ?? null,
      title: task.title,
      baselineHours: task.estimateHours ?? Number(connection.defaultBaselineHours),
      status: task.status,
      externalSource: connection.provider,
      externalRef: task.externalId,
      externalUrl: task.url,
    } as AiTaskEntity);
    return { entity, created: true };
  }

  private async getOrThrow(id: number): Promise<IntegrationConnectionEntity> {
    const connection = await this.connectionModel.findByPk(id);
    if (!connection) throw new NotFoundException('Không tìm thấy kết nối tích hợp');
    return connection;
  }

  private toPublic(row: IntegrationConnectionEntity): PublicConnection {
    return {
      id: row.id,
      provider: row.provider,
      name: row.name,
      baseUrl: row.baseUrl,
      externalProjectKey: row.externalProjectKey,
      authEmail: row.authEmail,
      targetProjectId: row.targetProjectId,
      defaultBaselineHours: Number(row.defaultBaselineHours),
      isActive: row.isActive,
      hasWebhookSecret: Boolean(row.webhookSecret),
      lastSyncedAt: row.lastSyncedAt,
    };
  }
}
