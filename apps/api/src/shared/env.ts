import { z } from 'zod';

/**
 * Environment schema — plan.md §25.3. Every variable the API process
 * reads goes through this Zod schema at import time; a missing or
 * malformed one crashes the container at startup rather than failing a
 * request at 2 a.m. during a sale (§25.3's own words).
 *
 * Scoping note (deliberate deviation, see apps/api report): §25.3 lists
 * variables under two headings, "Shared / infrastructure" and "apps/api".
 * This schema only includes variables the API *process itself* reads.
 * `GHCR_TOKEN`, `RESTIC_*`, `CLOUDFLARE_*`, `MONGO_ROOT_*` etc. are
 * deploy/backup/CI concerns consumed by shell scripts and docker-compose,
 * never by Node — including them here would make this schema lie about
 * what the process actually needs.
 *
 * Second deviation: this skeleton only implements the identity module.
 * Vars for integrations that don't exist yet (Stripe, Tabby, Tamara,
 * Resend, Unifonic, WhatsApp, Aramex, Sentry, S3/imgproxy, Meilisearch)
 * are still declared — so the schema documents the complete §25.3
 * contract and typos are still caught once each module lands — but kept
 * `.optional()` so today's boot doesn't demand secrets for features that
 * don't exist. Flip each to required as its module is built.
 */

const booleanFromString = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((v) => v === 'true');

const optionalString = () => z.string().min(1).optional();

const envSchema = z.object({
  // --- runtime -----------------------------------------------------------
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TZ: z.string().default('UTC'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_URL: z.string().url(),
  WEB_URL: z.string().url(),
  ADMIN_URL: z.string().url(),
  WORKER: booleanFromString('false'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // --- datastores ----------------------------------------------------------
  // §36.6: must be a replica-set connection string in every environment —
  // see mongo.ts for why a standalone mongod is not an option.
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),

  // --- auth (plan.md §10.1) -------------------------------------------------
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  COOKIE_DOMAIN: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  COOKIE_SECURE: booleanFromString('true'),
  ARGON2_MEMORY: z.coerce.number().int().positive().default(19456),
  ARGON2_TIME: z.coerce.number().int().positive().default(2),

  // --- rate limiting (plan.md §9.8) -----------------------------------------
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  // --- commerce constants (not consumed by the identity-only skeleton yet,
  // owned eventually by pricing/checkout/order) --------------------------
  VAT_RATE: z.coerce.number().min(0).max(1).default(0.05),
  FREE_SHIPPING_THRESHOLD_FILS: z.coerce.number().int().nonnegative().default(30_000),
  COD_FEE_FILS: z.coerce.number().int().nonnegative().default(1_000),
  COD_MAX_ORDER_FILS: z.coerce.number().int().nonnegative().default(200_000),
  STORE_TRN: optionalString(),
  STORE_NAME: optionalString(),
  STORE_EMAIL: optionalString(),
  STORE_PHONE: optionalString(),
  STORE_WHATSAPP: optionalString(),

  // --- payments (payment module not built yet) ------------------------------
  STRIPE_SECRET_KEY: optionalString(),
  STRIPE_WEBHOOK_SECRET: optionalString(),
  STRIPE_PUBLISHABLE_KEY: optionalString(),
  TABBY_SECRET_KEY: optionalString(),
  TABBY_PUBLIC_KEY: optionalString(),
  TABBY_WEBHOOK_SECRET: optionalString(),
  TAMARA_API_TOKEN: optionalString(),
  TAMARA_NOTIFICATION_TOKEN: optionalString(),

  // --- notifications (engagement/notification module not built yet) --------
  RESEND_API_KEY: optionalString(),
  EMAIL_FROM: optionalString(),
  EMAIL_REPLY_TO: optionalString(),
  UNIFONIC_APP_SID: optionalString(),
  UNIFONIC_SENDER_ID: optionalString(),
  WHATSAPP_PHONE_ID: optionalString(),
  WHATSAPP_TOKEN: optionalString(),

  // --- Google sign-in (stub route only, real verification not implemented) -
  GOOGLE_CLIENT_ID: optionalString(),
  GOOGLE_CLIENT_SECRET: optionalString(),

  // --- shipping (shipping module not built yet) -----------------------------
  ARAMEX_USERNAME: optionalString(),
  ARAMEX_PASSWORD: optionalString(),
  ARAMEX_ACCOUNT_NUMBER: optionalString(),
  ARAMEX_ACCOUNT_PIN: optionalString(),
  ARAMEX_ENTITY: optionalString(),

  // --- media (`content` module not built yet; Meilisearch vars below ARE
  // consumed today, by `catalog`'s search sync — plan.md §7.14) -----------
  // Deliberately still `.optional()`, not required: an unset `MEILI_HOST`
  // is a valid runtime state, not a config error — `search.service.ts`
  // always falls back to the Mongo regex path (plan.md §7.14: "search
  // never returns a 500"), so there is nothing to crash boot over.
  MEILI_HOST: optionalString(),
  MEILI_MASTER_KEY: optionalString(),
  MEILI_INDEX_PREFIX: z.string().default('dev_'),
  S3_ENDPOINT: optionalString(),
  S3_REGION: optionalString(),
  S3_BUCKET: optionalString(),
  S3_ACCESS_KEY: optionalString(),
  S3_SECRET_KEY: optionalString(),
  S3_PUBLIC_BASE_URL: optionalString(),
  IMGPROXY_KEY: optionalString(),
  IMGPROXY_SALT: optionalString(),
  IMGPROXY_BASE_URL: optionalString(),

  // --- observability ---------------------------------------------------------
  SENTRY_DSN: optionalString(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Never let a malformed/missing var surface as a 500 mid-request —
    // fail loud, fail at boot (plan.md §25.3).
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    // logger.ts imports env.ts, so the pino logger can't exist yet — this
    // is the one place in the codebase where console is the right tool.
    console.error(`Invalid environment configuration — refusing to boot:\n${issues}`);
    process.exit(1);
  }
  return result.data;
}

export const env: Env = loadEnv(process.env);
