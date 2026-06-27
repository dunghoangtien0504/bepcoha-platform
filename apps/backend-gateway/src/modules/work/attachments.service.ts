import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { EntityAttachmentEntity, TaskEntity } from '../../database/models';
import type { AttachmentEntityType } from '../../database/models';
import { CreateAttachmentDto } from './dto/work.dto';
import { decodeBase64Payload, extractExtension } from './work.util';

const STORAGE_PROVIDER = 'local';
/** Thư mục lưu file vật lý, tính từ cwd của tiến trình backend. */
const STORAGE_ROOT = join(process.cwd(), 'storage', 'attachments');

export interface AttachmentFileResult {
  filePath: string;
  fileName: string;
  mimeType: string;
}

/** File theo công việc (dạng phẳng) kèm tên công việc để FE hyperlink về task. */
export interface AttachmentWithTask {
  id: number;
  entityType: AttachmentEntityType;
  entityId: number;
  fileName: string;
  fileExtension: string | null;
  mimeType: string | null;
  fileSize: number | null;
  storageProvider: string | null;
  storagePath: string | null;
  storageUrl: string | null;
  description: string | null;
  sort: number;
  taskName: string | null;
}

export interface ProjectAttachments {
  projectFiles: EntityAttachmentEntity[];
  taskFiles: AttachmentWithTask[];
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly logger: AppLoggerService,
    @InjectModel(EntityAttachmentEntity)
    private readonly attachmentModel: typeof EntityAttachmentEntity,
    @InjectModel(TaskEntity) private readonly taskModel: typeof TaskEntity,
  ) {
    this.logger.setContext(AttachmentsService.name);
  }

  list(entityType: AttachmentEntityType, entityId: number): Promise<EntityAttachmentEntity[]> {
    return this.attachmentModel.findAll({
      where: { entityType, entityId },
      order: [
        ['sort', 'ASC'],
        ['id', 'ASC'],
      ],
    });
  }

  /**
   * Gom toàn bộ file của một dự án: file gắn trực tiếp dự án (Project Files) và file gắn theo
   * từng công việc của dự án (Task Attachments, kèm tên công việc để hyperlink về task).
   */
  async listByProject(projectId: number): Promise<ProjectAttachments> {
    const projectFiles = await this.attachmentModel.findAll({
      where: { entityType: 'projects', entityId: projectId },
      order: [['id', 'DESC']],
    });
    const tasks = await this.taskModel.findAll({ where: { projectId }, attributes: ['id', 'title'] });
    const nameById = new Map(tasks.map((t) => [t.id, t.title]));
    const taskIds = tasks.map((t) => t.id);
    const rawTaskFiles = taskIds.length
      ? await this.attachmentModel.findAll({
          where: { entityType: 'tasks', entityId: taskIds },
          order: [['id', 'DESC']],
        })
      : [];
    // Gắn kèm tên công việc (entityId = task id) để FE hiển thị cột Task + hyperlink.
    const taskFiles: AttachmentWithTask[] = rawTaskFiles.map((a) => ({
      id: a.id,
      entityType: a.entityType,
      entityId: a.entityId,
      fileName: a.fileName,
      fileExtension: a.fileExtension,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      storageProvider: a.storageProvider,
      storagePath: a.storagePath,
      storageUrl: a.storageUrl,
      description: a.description,
      sort: a.sort,
      taskName: nameById.get(a.entityId) ?? null,
    }));
    return { projectFiles, taskFiles };
  }

  async create(
    dto: CreateAttachmentDto,
    actorId: string | null,
  ): Promise<EntityAttachmentEntity> {
    const buffer = decodeBase64Payload(dto.contentBase64);
    const extension = extractExtension(dto.fileName);
    const dir = join(STORAGE_ROOT, dto.entityType, String(dto.entityId));
    await fs.mkdir(dir, { recursive: true });
    const storedName = `${Date.now()}-${randomBytes(4).toString('hex')}${extension ? `.${extension}` : ''}`;
    const absolutePath = join(dir, storedName);
    await fs.writeFile(absolutePath, buffer);
    const relativePath = join('attachments', dto.entityType, String(dto.entityId), storedName);

    const created = await this.attachmentModel.create({
      entityType: dto.entityType,
      entityId: dto.entityId,
      fileName: dto.fileName,
      fileExtension: extension,
      mimeType: dto.mimeType ?? null,
      fileSize: buffer.byteLength,
      storageProvider: STORAGE_PROVIDER,
      storagePath: relativePath,
      storageUrl: null,
      description: dto.description ?? null,
      sort: 0,
      createdBy: actorId,
      updatedBy: actorId,
    } as unknown as EntityAttachmentEntity);

    this.logger.logBusiness(AttachmentsService.name, 'Đã lưu file đính kèm', {
      id: created.id,
      entityType: dto.entityType,
      entityId: dto.entityId,
      size: buffer.byteLength,
    });
    return created;
  }

  async getForDownload(id: number): Promise<AttachmentFileResult> {
    const attachment = await this.attachmentModel.findByPk(id);
    if (!attachment || !attachment.storagePath) {
      throw new NotFoundException('Không tìm thấy file đính kèm');
    }
    const absolutePath = join(process.cwd(), 'storage', attachment.storagePath);
    return {
      filePath: absolutePath,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType ?? 'application/octet-stream',
    };
  }

  async delete(id: number): Promise<void> {
    const attachment = await this.attachmentModel.findByPk(id);
    if (!attachment) throw new NotFoundException('Không tìm thấy file đính kèm');
    if (attachment.storagePath) {
      const absolutePath = join(process.cwd(), 'storage', attachment.storagePath);
      try {
        await fs.unlink(absolutePath);
      } catch (error) {
        // File có thể đã bị xóa thủ công — chỉ ghi log, không chặn xóa metadata.
        this.logger.warn(`Không xóa được file vật lý: ${(error as Error).message}`);
      }
    }
    await this.attachmentModel.destroy({ where: { id } });
  }
}
