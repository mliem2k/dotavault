import { z } from 'zod'

const envSchema = z.object({
  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.string().min(1),
  PORT: z.string().optional().default('3000').transform(Number),
  OPENDOTA_API_KEY: z.string().optional(),
  // Path to the Go replay-parser binary (apps/replay-parser), baked into the
  // production image at /usr/local/bin/replay-parser.
  REPLAY_PARSER_BIN: z.string().optional().default('/usr/local/bin/replay-parser'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format())
  process.exit(1)
}

export const env = parsed.data
