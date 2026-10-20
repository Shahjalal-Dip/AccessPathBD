import { z, ZodError } from "zod";
import * as dotenv from "dotenv";
import { fromZodError } from "zod-validation-error";
dotenv.config();

/**
 * Single source of truth for environment variables.
 * The app refuses to start if a required value is missing or malformed.
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(5001),
    FRONTEND_URL: z.string().default("http://localhost:3000"),
    CORS_ORIGINS: z.string().optional(),
    COOKIE_SECRET: z.string().default("dev-cookie-secret-change-me"),

    // Auth
    JWT_BEARER_SECRET: z
      .string()
      .min(16, "must be at least 16 characters")
      .refine(
        (v) => !v.startsWith("replace-with"),
        "still the .env.example placeholder: generate a real secret",
      ),
    JWT_TTL: z.coerce.number().default(86400), // seconds (1 day)

    // Redis (token blacklist, caching)
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // Business rules (see docs/ERD_AND_RULES.md)
    FRESHNESS_DAYS: z.coerce.number().int().min(1).default(90),
    CONFLICT_WINDOW_DAYS: z.coerce.number().int().min(1).default(30),

    // Evidence uploads
    UPLOAD_DIR: z.string().default("storage/evidence"),
    UPLOAD_MAX_FILE_MB: z.coerce.number().min(0.1).default(5),
    UPLOAD_MAX_FILES_PER_REPORT: z.coerce.number().int().min(1).default(5),
    // Building cover photos (public once set)
    COVER_DIR: z.string().default("storage/covers"),

    // Rate limiting
    THROTTLE_TTL_SECONDS: z.coerce.number().default(60),
    THROTTLE_LIMIT: z.coerce.number().default(100),
    AUTH_THROTTLE_LIMIT: z.coerce.number().default(10),

    // Mail is optional for this project (email notifications are out of scope)
    MAILER_HOST: z.string().optional(),
    MAILER_PORT: z.coerce.number().optional(),
    MAILER_USER: z.string().optional(),
    MAILER_PASSWORD: z.string().optional(),
    MAILER_FROM: z.string().optional(),
  })
  .transform((envs) => ({
    ...envs,
    REDIS_URL: envs.REDIS_PASSWORD
      ? `redis://:${envs.REDIS_PASSWORD}@${envs.REDIS_HOST}:${envs.REDIS_PORT}`
      : `redis://${envs.REDIS_HOST}:${envs.REDIS_PORT}`,
  }));

const env = (() => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof ZodError)
      throw new Error(`ENV ${fromZodError(error).message}`);
    throw new Error(`ENV ${error}`);
  }
})();

export const appConfig = {
  default_schema_identifier: "public",
  default_migrations_folder: __dirname + "/../database/migrations",
  default_seeders_folder: __dirname + "/../database/seeders",
  env,
};
