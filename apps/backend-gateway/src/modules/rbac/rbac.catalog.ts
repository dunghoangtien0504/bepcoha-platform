import { IconType } from '../../database/models';

/**
 * Danh mục cấu hình RBAC dùng để seed lần đầu: modules, scopes, permissions và cây admin menus.
 * Đây là nguồn chân lý duy nhất; chỉnh ở đây rồi seeder sẽ đồng bộ (idempotent).
 */
export interface ModuleSeed {
  code: string;
  name: string;
  description: string;
  sort: number;
}

export interface ScopeSeed {
  moduleCode: string;
  code: string;
  name: string;
  sort: number;
  /** Các action sinh permission `${moduleCode}.${scopeCode}.${action}`. */
  actions: ReadonlyArray<{ action: string; name: string }>;
}

export interface MenuSeed {
  name: string;
  routePath: string | null;
  requirePermissions: string | null;
  iconType: IconType;
  iconValue: string;
  sort: number;
  children?: MenuSeed[];
}

export const MODULE_SEEDS: ReadonlyArray<ModuleSeed> = [
  { code: 'governance', name: 'Quản trị AI', description: 'Nghiệp vụ AI Governance Gateway', sort: 1 },
  { code: 'admin', name: 'Quản trị hệ thống', description: 'Người dùng, vai trò, menu', sort: 2 },
];

const CRUD = (singular: string): ReadonlyArray<{ action: string; name: string }> => [
  { action: 'view', name: `Xem ${singular}` },
  { action: 'create', name: `Tạo ${singular}` },
  { action: 'update', name: `Sửa ${singular}` },
  { action: 'delete', name: `Xóa ${singular}` },
];

export const SCOPE_SEEDS: ReadonlyArray<ScopeSeed> = [
  { moduleCode: 'governance', code: 'dashboard', name: 'Bảng điều khiển ROI/KPI', sort: 1, actions: [{ action: 'view', name: 'Xem dashboard' }] },
  { moduleCode: 'governance', code: 'reports', name: 'Báo cáo', sort: 2, actions: [{ action: 'view', name: 'Xem báo cáo' }] },
  { moduleCode: 'governance', code: 'projects', name: 'Dự án', sort: 3, actions: CRUD('dự án') },
  { moduleCode: 'governance', code: 'tasks', name: 'Tác vụ', sort: 4, actions: CRUD('tác vụ') },
  {
    moduleCode: 'governance',
    code: 'quota',
    name: 'Hạn ngạch & Addon',
    sort: 5,
    actions: [
      { action: 'view', name: 'Xem hạn ngạch' },
      { action: 'manage', name: 'Quản lý hạn ngạch & addon' },
    ],
  },
  {
    moduleCode: 'governance',
    code: 'integrations',
    name: 'Tích hợp 3rd-party',
    sort: 6,
    actions: [...CRUD('kết nối'), { action: 'sync', name: 'Đồng bộ tích hợp' }],
  },
  {
    moduleCode: 'governance',
    code: 'settings',
    name: 'Cấu hình hệ thống',
    sort: 7,
    actions: [
      { action: 'view', name: 'Xem cấu hình' },
      { action: 'update', name: 'Sửa cấu hình' },
    ],
  },
  { moduleCode: 'governance', code: 'audit', name: 'Nhật ký kiểm toán', sort: 8, actions: [{ action: 'view', name: 'Xem audit log' }] },
  {
    moduleCode: 'governance',
    code: 'usage',
    name: 'Đo lường AI Usage',
    sort: 9,
    actions: [
      { action: 'view', name: 'Xem đo lường usage' },
      { action: 'ingest', name: 'Nạp/ước lượng usage' },
    ],
  },
  {
    moduleCode: 'governance',
    code: 'prompts',
    name: 'Prompt Management',
    sort: 10,
    actions: [
      { action: 'view', name: 'Xem prompt' },
      { action: 'manage', name: 'Quản lý prompt (cache/knowledge)' },
    ],
  },
  { moduleCode: 'admin', code: 'users', name: 'Người dùng', sort: 1, actions: CRUD('người dùng') },
  { moduleCode: 'admin', code: 'roles', name: 'Vai trò', sort: 2, actions: CRUD('vai trò') },
  { moduleCode: 'admin', code: 'permissions', name: 'Quyền', sort: 3, actions: [{ action: 'view', name: 'Xem quyền' }] },
  { moduleCode: 'admin', code: 'modules', name: 'Module & Scope', sort: 4, actions: [{ action: 'view', name: 'Xem module' }] },
  { moduleCode: 'admin', code: 'menus', name: 'Admin Menus', sort: 5, actions: CRUD('menu') },
];

/**
 * Tên các menu cũ cần gỡ khỏi DB khi tái cấu trúc (findOrCreate không tự xóa bản ghi thừa).
 */
export const OBSOLETE_MENU_NAMES: ReadonlyArray<string> = ['Dự án & Hạn ngạch'];

export const MENU_SEEDS: ReadonlyArray<MenuSeed> = [
  {
    name: 'ROI & KPI',
    routePath: '/dashboard',
    requirePermissions: 'governance.dashboard.view',
    iconType: 'material_symbol',
    iconValue: 'dashboard',
    sort: 1,
  },
  {
    name: 'Quản lý Công việc',
    routePath: null,
    requirePermissions: null,
    iconType: 'material_symbol',
    iconValue: 'work',
    sort: 2,
    children: [
      {
        name: 'Dự án',
        routePath: '/work/projects',
        requirePermissions: 'governance.projects.view',
        iconType: 'material_symbol',
        iconValue: 'folder_managed',
        sort: 1,
      },
      {
        name: 'Công việc',
        routePath: '/work/tasks',
        requirePermissions: 'governance.tasks.view',
        iconType: 'material_symbol',
        iconValue: 'task_alt',
        sort: 2,
      },
    ],
  },
  {
    name: 'Quản lý Token',
    routePath: null,
    requirePermissions: null,
    iconType: 'material_symbol',
    iconValue: 'toll',
    sort: 3,
    children: [
      {
        name: 'Danh sách phân bổ',
        routePath: '/tokens/allocations',
        requirePermissions: 'governance.quota.view',
        iconType: 'material_symbol',
        iconValue: 'data_usage',
        sort: 1,
      },
      {
        name: 'Hạn ngạch của tôi',
        routePath: '/me/quota',
        requirePermissions: null,
        iconType: 'material_symbol',
        iconValue: 'badge',
        sort: 2,
      },
    ],
  },
  {
    name: 'Đo lường AI Usage',
    routePath: '/usage',
    requirePermissions: 'governance.usage.view',
    iconType: 'material_symbol',
    iconValue: 'insights',
    sort: 4,
  },
  {
    name: 'Prompt Management',
    routePath: null,
    requirePermissions: 'governance.prompts.view',
    iconType: 'material_symbol',
    iconValue: 'forum',
    sort: 5,
    children: [
      {
        name: 'Prompt Performance',
        routePath: '/prompts/performance',
        requirePermissions: 'governance.prompts.view',
        iconType: 'material_symbol',
        iconValue: 'monitoring',
        sort: 1,
      },
      {
        name: 'Prompt List',
        routePath: '/prompts/list',
        requirePermissions: 'governance.prompts.view',
        iconType: 'material_symbol',
        iconValue: 'list_alt',
        sort: 2,
      },
      {
        name: 'Prompt Caching',
        routePath: '/prompts/cache',
        requirePermissions: 'governance.prompts.view',
        iconType: 'material_symbol',
        iconValue: 'bookmark',
        sort: 3,
      },
    ],
  },
  {
    name: 'Tích hợp 3rd-party',
    routePath: '/integrations',
    requirePermissions: 'governance.integrations.view',
    iconType: 'material_symbol',
    iconValue: 'hub',
    sort: 6,
  },
  {
    name: 'Quản trị hệ thống',
    routePath: null,
    requirePermissions: null,
    iconType: 'material_symbol',
    iconValue: 'admin_panel_settings',
    sort: 8,
    children: [
      {
        name: 'Người dùng',
        routePath: '/admin/users',
        requirePermissions: 'admin.users.view',
        iconType: 'material_symbol',
        iconValue: 'group',
        sort: 1,
      },
      {
        name: 'Vai trò & Phân quyền',
        routePath: '/admin/roles',
        requirePermissions: 'admin.roles.view',
        iconType: 'material_symbol',
        iconValue: 'shield_person',
        sort: 2,
      },
      {
        name: 'Admin Menus',
        routePath: '/admin/menus',
        requirePermissions: 'admin.menus.view',
        iconType: 'material_symbol',
        iconValue: 'menu',
        sort: 3,
      },
    ],
  },
  {
    name: 'Cấu hình hệ thống',
    routePath: '/settings',
    requirePermissions: 'governance.settings.view',
    iconType: 'material_symbol',
    iconValue: 'settings',
    sort: 9,
  },
];
