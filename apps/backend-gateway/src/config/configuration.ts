/**
 * Tập trung hóa toàn bộ biến môi trường vào một object có kiểu rõ ràng (Type-safe).
 * Mọi module khác đọc cấu hình qua ConfigService thay vì truy cập process.env trực tiếp.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  dbSync: boolean;
  dbSeed: boolean;
  appSecret: string;
  credentialSecret: string;
  usdToVndFallback: number;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface ProviderConfig {
  openAiApiKey: string;
  openAiBaseUrl: string;
  anthropicApiKey: string;
  anthropicBaseUrl: string;
  /** Endpoint LLM nội bộ tương thích OpenAI (Ollama mặc định :11434/v1, vLLM :8000/v1). */
  localLlmBaseUrl: string;
  /** Tùy chọn — vLLM cần Bearer; Ollama để trống. */
  localLlmApiKey: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface IntegrationConfig {
  apiKey: string;
}

export interface AdminSeedConfig {
  email: string;
  password: string;
}

export interface RootConfig {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  provider: ProviderConfig;
  jwt: JwtConfig;
  integration: IntegrationConfig;
  adminSeed: AdminSeedConfig;
}

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true' || value === '1';
};

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export default (): RootConfig => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: toInt(process.env.BACKEND_PORT, 3000),
    dbSync: toBool(process.env.DB_SYNC, true),
    dbSeed: toBool(process.env.DB_SEED, true),
    appSecret: process.env.APP_SECRET ?? 'app-secret',
    credentialSecret: process.env.CREDENTIAL_SECRET ?? 'credential-secret',
    usdToVndFallback: toInt(process.env.USD_TO_VND_FALLBACK, 25400),
  },
  database: {
    host: process.env.MYSQL_HOST ?? 'localhost',
    port: toInt(process.env.MYSQL_PORT, 3306),
    database: process.env.MYSQL_DATABASE ?? 'ai_governance_gateway',
    username: process.env.MYSQL_USERNAME ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: toInt(process.env.REDIS_PORT, 6379),
    username: process.env.REDIS_USER,
    password: process.env.REDIS_PASSWORD,
  },
  provider: {
    openAiApiKey: process.env.OPENAI_API_KEY ?? '',
    openAiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1',
    localLlmBaseUrl: process.env.LOCAL_LLM_BASE_URL ?? 'http://localhost:11434/v1',
    localLlmApiKey: process.env.LOCAL_LLM_API_KEY ?? '',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'jwt-secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  },
  integration: {
    apiKey: process.env.INTEGRATION_API_KEY ?? 'change-me-integration-key',
  },
  adminSeed: {
    email: process.env.ADMIN_EMAIL ?? 'admin@techrun.ai.vn',
    password: process.env.ADMIN_PASSWORD ?? 'change-me-admin-password',
  },
});
