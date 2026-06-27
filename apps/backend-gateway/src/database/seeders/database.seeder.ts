import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { hashPassword } from '../../common/utils/password.util';
import { AppConfig } from '../../config/configuration';
import {
  AppUserEntity,
  ProjectCategoryEntity,
  ProjectEntity,
  ProjectMemberEntity,
  ProjectPhaseEntity,
  RoleEntity,
  RolePermissionEntity,
  SystemSettingEntity,
  TaskCategoryEntity,
  TaskEntity,
  UserEntity,
  UserTokenQuotaEntity,
} from '../models';
import { PROJECT_MANAGEMENT_POLICY } from './project-management-policy';

/**
 * Nạp dữ liệu khởi tạo (system_settings, dự án mẫu, user mẫu) khi DB_SEED=true.
 * Tất cả thao tác idempotent qua findOrCreate để chạy lại nhiều lần không nhân bản.
 */
@Injectable()
export class DatabaseSeeder implements OnApplicationBootstrap {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
    @InjectModel(SystemSettingEntity) private readonly settingModel: typeof SystemSettingEntity,
    @InjectModel(ProjectEntity) private readonly projectModel: typeof ProjectEntity,
    @InjectModel(ProjectCategoryEntity)
    private readonly projectCategoryModel: typeof ProjectCategoryEntity,
    @InjectModel(TaskCategoryEntity)
    private readonly taskCategoryModel: typeof TaskCategoryEntity,
    @InjectModel(AppUserEntity) private readonly userModel: typeof AppUserEntity,
    @InjectModel(UserEntity) private readonly dashboardUserModel: typeof UserEntity,
    @InjectModel(RoleEntity) private readonly roleModel: typeof RoleEntity,
    @InjectModel(RolePermissionEntity)
    private readonly rolePermissionModel: typeof RolePermissionEntity,
    @InjectModel(ProjectPhaseEntity) private readonly phaseModel: typeof ProjectPhaseEntity,
    @InjectModel(ProjectMemberEntity) private readonly memberModel: typeof ProjectMemberEntity,
    @InjectModel(TaskEntity) private readonly workTaskModel: typeof TaskEntity,
    @InjectModel(UserTokenQuotaEntity) private readonly quotaModel: typeof UserTokenQuotaEntity,
  ) {
    this.logger.setContext(DatabaseSeeder.name);
  }

  // Chạy sau khi tất cả onModuleInit hoàn tất (SchemaPatch vá schema, RbacSeeder tạo user)
  // để tránh đua tiến trình: seed dữ liệu khi cột đã đúng kiểu (vd setting_value = TEXT).
  async onApplicationBootstrap(): Promise<void> {
    const app = this.configService.getOrThrow<AppConfig>('app');
    if (!app.dbSeed) return;

    try {
      await this.seedSettings();
      await this.seedWorkCategories();
      await this.seedDemoWorkspace();
      await this.seedDogfoodProject();
      await this.seedProjectTwoTeamAndWork();
      this.logger.logBusiness(DatabaseSeeder.name, 'Seed dữ liệu khởi tạo hoàn tất');
    } catch (error) {
      this.logger.error('Seed dữ liệu thất bại', (error as Error).stack);
    }
  }

  private async seedSettings(): Promise<void> {
    const defaults: ReadonlyArray<[string, string, string]> = [
      ['hours_per_manday', '8', 'Số giờ làm việc hành chính tiêu chuẩn một ngày công'],
      ['saturday_hours', '4', 'Số giờ làm việc hành chính ngày Thứ Bảy'],
      ['sunday_hours', '0', 'Chủ Nhật nghỉ'],
      ['ot_multiplier', '1.5', 'Hệ số tăng ca ngoài khung giờ hành chính/ngày nghỉ'],
      ['work_start_hour', '8', 'Giờ bắt đầu khung hành chính (0-23)'],
      ['work_end_hour', '17', 'Giờ kết thúc khung hành chính (0-23)'],
      [
        'default_hourly_rate_usd',
        '0',
        'Đơn giá giờ công mặc định (USD) khi task chưa gắn nhân sự có log AI. 0 = dùng trung bình hệ thống',
      ],
      ['anomaly_prompt_threshold', '4', 'Ngưỡng số prompt để cảnh báo task bất thường (vẫn IN_PROGRESS)'],
      [
        'anomaly_cost_threshold_vnd',
        '200000',
        'Ngưỡng chi phí (VND) để cảnh báo task bất thường khi chưa merge',
      ],
      ['currency_rate_mode', 'API', 'Chế độ tỷ giá USD→VND: API (gọi API public) hoặc MANUAL (dùng usd_to_vnd_rate)'],
      ['usd_to_vnd_rate', '25400', 'Tỷ giá USD→VND khai báo thủ công (chỉ áp dụng khi currency_rate_mode = MANUAL)'],
      [
        'roi_review_hours_per_task',
        '0.5',
        'Số giờ DEV review/nghiệm thu trung bình mỗi task — dùng trong công thức ROI thực tế (Dashboard)',
      ],
      [
        'waste_max_prompts_per_conversation',
        '5',
        'Số prompt hợp lý tối đa cho một hội thoại/ngữ cảnh; vượt mức bị tính là token lãng phí / prompt kém',
      ],
      ['prompt_preview_chars', '2000', 'Độ dài bản rút gọn prompt lưu lại (ký tự) — Prompt Management'],
      [
        'prompt_high_token_threshold',
        '6000',
        'Ngưỡng token một prompt bị coi là cao bất thường (đánh giá prompt kém) — Prompt Management',
      ],
    ];
    for (const [settingKey, settingValue, description] of defaults) {
      await this.settingModel.findOrCreate({
        where: { settingKey },
        defaults: { settingKey, settingValue, description } as SystemSettingEntity,
      });
    }

    // Cấu hình noti: bắn sự kiện tới webhook Node-RED (data-driven, bật/tắt theo loại sự kiện).
    await this.settingModel.findOrCreate({
      where: { settingKey: 'notification.policy' },
      defaults: {
        settingKey: 'notification.policy',
        settingValue: JSON.stringify({
          enabled: true,
          webhookUrl: 'http://localhost:1880/aigg/notify',
          events: { 'task.assigned_ai': true, 'quota.exceeded': true, 'usage.recorded': true },
        }),
        description:
          'Cấu hình thông báo: bật/tắt, webhook Node-RED nhận sự kiện, và bật/tắt theo từng loại sự kiện.',
      } as SystemSettingEntity,
    });

    // Cấu hình chính sách quản lý dự án (KPI, tiến độ, màu trạng thái, quy tắc bình luận).
    await this.settingModel.findOrCreate({
      where: { settingKey: 'project.managenent.policy' },
      defaults: {
        settingKey: 'project.managenent.policy',
        settingValue: JSON.stringify(PROJECT_MANAGEMENT_POLICY),
        description:
          'Cấu hình KPI, tiến độ, trạng thái, bình luận, quy tắc tính toán và hiển thị cho Task, Phase và Project.',
      } as SystemSettingEntity,
    });
  }

  /** Nạp danh mục dự án & danh mục công việc mặc định cho module Quản lý Dự án mới. */
  private async seedWorkCategories(): Promise<void> {
    const projectCategories: ReadonlyArray<[string, string]> = [
      ['Triển khai phần mềm', 'Các dự án phát triển & triển khai phần mềm'],
      ['Marketing Campaign', 'Các chiến dịch marketing'],
      ['Xây dựng sản phẩm', 'Các dự án phát triển sản phẩm mới'],
      ['Chuyển đổi số', 'Các dự án chuyển đổi số nội bộ'],
    ];
    let projectSort = 0;
    for (const [title, description] of projectCategories) {
      projectSort += 1;
      await this.projectCategoryModel.findOrCreate({
        where: { title },
        defaults: {
          title,
          description,
          sort: projectSort,
          isActive: true,
        } as ProjectCategoryEntity,
      });
    }

    const taskCategories: ReadonlyArray<[string, string]> = [
      ['Development', '#2563eb'],
      ['Testing', '#16a34a'],
      ['Design', '#db2777'],
      ['Marketing', '#f59e0b'],
      ['Operation', '#0891b2'],
      ['Training', '#7c3aed'],
      ['Meeting', '#64748b'],
    ];
    let taskSort = 0;
    for (const [title, color] of taskCategories) {
      taskSort += 1;
      await this.taskCategoryModel.findOrCreate({
        where: { title, projectId: null },
        defaults: {
          title,
          color,
          iconType: 'material_symbol',
          iconValue: 'task_alt',
          projectId: null,
          sort: taskSort,
          isActive: true,
        } as TaskCategoryEntity,
      });
    }
  }

  private async seedDemoWorkspace(): Promise<void> {
    await this.projectModel.findOrCreate({
      where: { name: 'STORO Core Platform' },
      defaults: {
        name: 'STORO Core Platform',
        description: 'Dự án lõi minh họa cho AI Governance Gateway',
      } as ProjectEntity,
    });

    const devEmail = 'dev@storo.vn';
    await this.userModel.findOrCreate({
      where: { email: devEmail },
      defaults: {
        email: devEmail,
        fullName: 'Nguyen Van Dev',
        role: 'DEVELOPER',
        internalToken: 'storo_live_demo_dev_token_0001',
        hourlyRateUsd: 12,
        isActive: true,
      } as AppUserEntity,
    });

    // Tài khoản dashboard (RBAC users) tương ứng dev — chủ thể của hạn ngạch token.
    const dashboardDev = await this.seedDashboardEmployee(devEmail, 'Nguyen Van Dev', 'Developer');
    if (dashboardDev) {
      await this.quotaModel.findOrCreate({
        where: { userId: dashboardDev.id },
        defaults: {
          userId: dashboardDev.id,
          dailyLimit: 200000,
          weeklyLimit: 1000000,
          monthlyLimit: 4000000,
          taskLimit: 500000,
        } as UserTokenQuotaEntity,
      });
    }

    await this.userModel.findOrCreate({
      where: { email: 'admin@storo.vn' },
      defaults: {
        email: 'admin@storo.vn',
        fullName: 'Tech Lead Admin',
        role: 'CTO',
        internalToken: 'storo_live_demo_admin_token_0002',
        passwordHash: hashPassword('Admin@123'),
        hourlyRateUsd: 30,
        isActive: true,
      } as AppUserEntity,
    });
  }

  /**
   * Seed một nhân sự vào bảng RBAC `users` (gắn vai trò mặc định) để gán hạn ngạch token.
   * Trả về null nếu chưa có vai trò nào (RbacSeeder chưa chạy) — khi đó bỏ qua an toàn.
   */
  private async seedDashboardEmployee(
    email: string,
    fullName: string,
    title: string,
  ): Promise<UserEntity | null> {
    const role =
      (await this.roleModel.findOne({ where: { code: 'super_admin' } })) ??
      (await this.roleModel.findOne());
    if (!role) return null;

    const [employee] = await this.dashboardUserModel.findOrCreate({
      where: { email },
      defaults: {
        roleId: role.id,
        fullName,
        displayName: fullName,
        email,
        passwordHashed: hashPassword('Dev@123'),
        gender: 'unknow',
        title,
        isAdmin: false,
        isActive: true,
      } as UserEntity,
    });
    return employee;
  }

  /**
   * Mục tiêu 2: "dogfooding" — dùng CHÍNH dự án này làm ví dụ. Chỉ tạo dự án "AI Governance
   * Gateway" (id=2); KHÔNG seed ai_tasks/audit demo nữa — ai_tasks giờ là UUID tự sinh, tạo
   * thực tế qua luồng "Giao việc cho AI". Idempotent qua findOrCreate theo tên.
   */
  private async seedDogfoodProject(): Promise<void> {
    await this.projectModel.findOrCreate({
      where: { name: 'AI Governance Gateway' },
      defaults: {
        name: 'AI Governance Gateway',
        description:
          'Dự án nội bộ — dùng chính nó để đo usage & hiệu quả khi lập trình bằng Claude Pro (gói cá nhân).',
      } as ProjectEntity,
    });
  }

  /**
   * Yêu cầu nghiệp vụ: dựng đội ngũ & dữ liệu công việc cho dự án id=2 (AI Governance Gateway).
   * Gồm: roles (PM/BA/DEV/QA) + permissions, users theo role, cập nhật thông tin dự án,
   * project_phases, project_members (map role dự án), tasks gắn phase + danh mục.
   * Idempotent toàn bộ qua findOrCreate / cập nhật có điều kiện.
   */
  private async seedProjectTwoTeamAndWork(): Promise<void> {
    const CREATED_BY = '31f5368e-0482-4c7d-83a0-1a6ad232ff13';

    // --- (1) Seed roles + permissions tương ứng ---
    const roleDefs: ReadonlyArray<{
      code: string;
      name: string;
      description: string;
      permissions: ReadonlyArray<string>;
    }> = [
      {
        code: 'pm',
        name: 'Project Manager',
        description: 'Quản lý dự án — toàn quyền dự án & công việc',
        permissions: [
          'governance.dashboard.view',
          'governance.reports.view',
          'governance.projects.view',
          'governance.projects.create',
          'governance.projects.update',
          'governance.projects.delete',
          'governance.tasks.view',
          'governance.tasks.create',
          'governance.tasks.update',
          'governance.tasks.delete',
          'governance.usage.view',
          'governance.quota.view',
          'governance.audit.view',
          'admin.users.view',
        ],
      },
      {
        code: 'ba',
        name: 'Business Analyst',
        description: 'Phân tích nghiệp vụ — quản lý yêu cầu & công việc',
        permissions: [
          'governance.dashboard.view',
          'governance.reports.view',
          'governance.projects.view',
          'governance.tasks.view',
          'governance.tasks.create',
          'governance.tasks.update',
          'governance.usage.view',
        ],
      },
      {
        code: 'dev',
        name: 'Developer',
        description: 'Lập trình viên — thực thi công việc & nạp usage',
        permissions: [
          'governance.dashboard.view',
          'governance.projects.view',
          'governance.tasks.view',
          'governance.tasks.update',
          'governance.usage.view',
          'governance.usage.ingest',
        ],
      },
      {
        code: 'qa',
        name: 'Quality Assurance',
        description: 'Kiểm thử — kiểm soát chất lượng công việc',
        permissions: [
          'governance.dashboard.view',
          'governance.reports.view',
          'governance.projects.view',
          'governance.tasks.view',
          'governance.tasks.update',
          'governance.usage.view',
        ],
      },
    ];

    const roleIdByCode = new Map<string, string>();
    for (const def of roleDefs) {
      const [role] = await this.roleModel.findOrCreate({
        where: { code: def.code },
        defaults: {
          code: def.code,
          name: def.name,
          description: def.description,
          isActive: true,
        } as RoleEntity,
      });
      roleIdByCode.set(def.code, role.id);
      for (const permissionCode of def.permissions) {
        await this.rolePermissionModel.findOrCreate({
          where: { roleId: role.id, permissionCode },
          defaults: { roleId: role.id, permissionCode } as RolePermissionEntity,
        });
      }
    }

    // --- (2) Seed users theo mỗi role ---
    const userDefs: ReadonlyArray<{
      key: string;
      email: string;
      fullName: string;
      title: string;
      roleCode: string;
    }> = [
      { key: 'pm', email: 'pm@aigg.vn', fullName: 'Phạm Minh Quản', title: 'Project Manager', roleCode: 'pm' },
      { key: 'ba', email: 'ba@aigg.vn', fullName: 'Bùi Anh Phân', title: 'Business Analyst', roleCode: 'ba' },
      { key: 'dev1', email: 'dev1@aigg.vn', fullName: 'Đặng Văn Phát', title: 'Backend Developer', roleCode: 'dev' },
      { key: 'dev2', email: 'dev2@aigg.vn', fullName: 'Đỗ Tiến Dũng', title: 'Frontend Developer', roleCode: 'dev' },
      { key: 'qa', email: 'qa@aigg.vn', fullName: 'Quách Anh Kiểm', title: 'QA Engineer', roleCode: 'qa' },
    ];

    const userIdByKey = new Map<string, string>();
    for (const def of userDefs) {
      const roleId = roleIdByCode.get(def.roleCode);
      if (!roleId) continue;
      const [user] = await this.dashboardUserModel.findOrCreate({
        where: { email: def.email },
        defaults: {
          roleId,
          fullName: def.fullName,
          displayName: def.fullName,
          email: def.email,
          passwordHashed: hashPassword('Dev@123'),
          gender: 'unknow',
          title: def.title,
          isAdmin: false,
          isActive: true,
        } as UserEntity,
      });
      userIdByKey.set(def.key, user.id);
    }

    const pmUserId = userIdByKey.get('pm');
    if (!pmUserId) return;

    // report_to: PM báo cáo cho người tạo (cấp trên); các thành viên báo cáo cho PM.
    await this.dashboardUserModel.update(
      { reportToId: CREATED_BY },
      { where: { id: pmUserId, reportToId: null } },
    );
    for (const key of ['ba', 'dev1', 'dev2', 'qa']) {
      const memberId = userIdByKey.get(key);
      if (!memberId) continue;
      await this.dashboardUserModel.update(
        { reportToId: pmUserId },
        { where: { id: memberId, reportToId: null } },
      );
    }

    // --- Cập nhật thông tin dự án id=2 (fallback theo tên nếu id khác) ---
    const project =
      (await this.projectModel.findByPk(2)) ??
      (await this.projectModel.findOne({ where: { name: 'AI Governance Gateway' } }));
    if (!project) return;

    project.startDate = new Date('2026-06-15T00:00:00+07:00');
    project.endDate = new Date('2026-06-30T00:00:00+07:00');
    project.projectCategoryId = 1;
    project.ownerId = pmUserId;
    project.createdById = CREATED_BY;
    project.createdBy = CREATED_BY;
    if (!project.code) {
      project.code = `AIGG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    }
    await project.save();
    const projectId = project.id;

    // --- (3) Seed project_phases cho dự án ---
    const phaseDefs: ReadonlyArray<{
      title: string;
      status: ProjectPhaseEntity['status'];
    }> = [
      { title: 'Khởi động', status: 'completed' },
      { title: 'Phân tích yêu cầu', status: 'completed' },
      { title: 'Thiết kế', status: 'in_progress' },
      { title: 'Phát triển', status: 'in_progress' },
      { title: 'Kiểm thử & Nghiệm thu', status: 'pending' },
    ];
    const phaseIdByTitle = new Map<string, number>();
    let phaseSort = 0;
    for (const def of phaseDefs) {
      phaseSort += 1;
      const [phase] = await this.phaseModel.findOrCreate({
        where: { projectId, title: def.title },
        defaults: {
          projectId,
          title: def.title,
          sort: phaseSort,
          status: def.status,
          createdBy: CREATED_BY,
        } as ProjectPhaseEntity,
      });
      phaseIdByTitle.set(def.title, phase.id);
    }

    // --- (4) Seed project_members (map role dự án owner/manager/member/viewer) ---
    const memberDefs: ReadonlyArray<{ key: string; role: ProjectMemberEntity['role'] }> = [
      { key: 'pm', role: 'manager' },
      { key: 'ba', role: 'member' },
      { key: 'dev1', role: 'member' },
      { key: 'dev2', role: 'member' },
      { key: 'qa', role: 'member' },
    ];
    for (const def of memberDefs) {
      const userId = userIdByKey.get(def.key);
      if (!userId) continue;
      await this.memberModel.findOrCreate({
        where: { projectId, userId },
        defaults: {
          projectId,
          userId,
          role: def.role,
          isActive: true,
          createdBy: CREATED_BY,
        } as ProjectMemberEntity,
      });
    }

    // --- (5) Seed tasks gắn phase + danh mục công việc + người phụ trách ---
    const categories = await this.taskCategoryModel.findAll({ where: { projectId: null } });
    const categoryIdByTitle = new Map<string, number>();
    for (const category of categories) {
      categoryIdByTitle.set(category.title, category.id);
    }
    const fallbackCategoryId = categories[0]?.id;
    if (fallbackCategoryId === undefined) return;

    // start/dur = số ngày lệch từ ngày bắt đầu dự án + số ngày thực hiện (phục vụ Gantt).
    const taskDefs: ReadonlyArray<{
      title: string;
      phase: string;
      category: string;
      assignee: string;
      status: TaskEntity['status'];
      start: number;
      dur: number;
    }> = [
      { title: 'Lập kế hoạch & phân rã công việc', phase: 'Khởi động', category: 'Meeting', assignee: 'pm', status: 'completed', start: 0, dur: 2 },
      { title: 'Thu thập & phân tích yêu cầu', phase: 'Phân tích yêu cầu', category: 'Operation', assignee: 'ba', status: 'completed', start: 2, dur: 3 },
      { title: 'Thiết kế kiến trúc & UI/UX', phase: 'Thiết kế', category: 'Design', assignee: 'dev1', status: 'in_progress', start: 5, dur: 4 },
      { title: 'Phát triển API backend', phase: 'Phát triển', category: 'Development', assignee: 'dev1', status: 'in_progress', start: 9, dur: 4 },
      { title: 'Phát triển giao diện dashboard', phase: 'Phát triển', category: 'Development', assignee: 'dev2', status: 'in_progress', start: 9, dur: 5 },
      { title: 'Viết & thực thi test case', phase: 'Kiểm thử & Nghiệm thu', category: 'Testing', assignee: 'qa', status: 'todo', start: 13, dur: 2 },
      { title: 'Nghiệm thu & bàn giao', phase: 'Kiểm thử & Nghiệm thu', category: 'Meeting', assignee: 'pm', status: 'todo', start: 15, dur: 1 },
    ];
    const baseDate = project.startDate ? new Date(project.startDate) : new Date();
    const dayMs = 86_400_000;
    for (const def of taskDefs) {
      const slug = this.slugify(`${def.title}-p${projectId}`);
      const categoryId = categoryIdByTitle.get(def.category) ?? fallbackCategoryId;
      const phaseId = phaseIdByTitle.get(def.phase) ?? null;
      const assigneeId = userIdByKey.get(def.assignee) ?? null;
      const startDate = new Date(baseDate.getTime() + def.start * dayMs);
      const dueDate = new Date(startDate.getTime() + (def.dur - 1) * dayMs);
      // Idempotent theo khóa nghiệp vụ (project + title) để không tạo trùng dù chiến lược slug đổi.
      await this.workTaskModel.findOrCreate({
        where: { projectId, title: def.title },
        defaults: {
          taskCategoryId: categoryId,
          projectId,
          projectPhaseId: phaseId,
          sourceType: 'project',
          priority: 'medium',
          assignedBy: pmUserId,
          assignedToUserId: assigneeId,
          title: def.title,
          slug,
          status: def.status,
          startDate,
          dueDate,
          createdBy: CREATED_BY,
        } as TaskEntity,
      });
    }
  }

  /** Chuẩn hóa slug: bỏ dấu tiếng Việt, hạ chữ thường, thay khoảng trắng bằng gạch nối. */
  private slugify(input: string): string {
    return input
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
