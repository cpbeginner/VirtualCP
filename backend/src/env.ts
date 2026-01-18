import path from "path";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const EnvSchema = z.object({
  PORT: z
    .string()
    .default("3001")
    .transform((v) => Number(v))
    .pipe(z.number().int().positive()),
  JWT_SECRET: z.string().min(1),
  MOCK_OJ: z
    .string()
    .optional()
    .default("0")
    .transform((v) => v === "1"),
  POLL_INTERVAL_SECONDS: z
    .string()
    .optional()
    .default("30")
    .transform((v) => Number(v))
    .pipe(z.number().int().positive()),
  CORS_ORIGIN: z.string().optional().default("http://localhost:5173")
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables", parsed.error.flatten());
  process.exit(1);
}

export const env = {
  PORT: parsed.data.PORT,
  JWT_SECRET: parsed.data.JWT_SECRET,
  MOCK_OJ: parsed.data.MOCK_OJ,
  POLL_INTERVAL_SECONDS: parsed.data.POLL_INTERVAL_SECONDS,
  CORS_ORIGIN: parsed.data.CORS_ORIGIN,
  DB_FILE_PATH: path.join(__dirname, "..", "data", "db.json"),
  CACHE_DIR: path.join(__dirname, "..", "data", "cache"),
  FIXTURES_DIR: path.join(__dirname, "..", "test", "fixtures"),
};

