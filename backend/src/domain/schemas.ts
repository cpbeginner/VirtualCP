import { z } from "zod";

export const UsernameSchema = z.string().min(3).max(32);
export const PasswordSchema = z.string().min(6).max(128);

const OptionalNonEmptyString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1).optional(),
);

const OptionalTrimmedString = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z.string().optional(),
);

export const RegisterSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
  cfHandle: OptionalNonEmptyString,
  atcoderUser: OptionalNonEmptyString,
});

export const LoginSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
});

export const PatchHandlesSchema = z.object({
  cfHandle: OptionalTrimmedString,
  atcoderUser: OptionalTrimmedString,
});

export const RefreshCacheSchema = z.object({});

export const CreateContestSchema = z.object({
  name: z.string().min(1).max(100),
  durationMinutes: z.number().int().positive(),
  platforms: z
    .object({
      codeforces: z.boolean(),
      atcoder: z.boolean(),
    })
    .optional(),
  count: z.number().int().positive().optional(),
  problemSpecs: z
    .array(
      z.object({
        platform: z.enum(["codeforces", "atcoder"]),
        min: z.number().int().optional(),
        max: z.number().int().optional(),
      }),
    )
    .min(1)
    .optional(),
  cfRatingMin: z.number().int().optional(),
  cfRatingMax: z.number().int().optional(),
  atDifficultyMin: z.number().int().optional(),
  atDifficultyMax: z.number().int().optional(),
  cfTags: z.array(z.string()).optional(),
  excludeAlreadySolved: z.boolean().optional(),
  seed: z.string().optional(),
  startImmediately: z.boolean().optional(),
}).superRefine((val, ctx) => {
  const hasSpecs = Array.isArray(val.problemSpecs) && val.problemSpecs.length > 0;
  const hasLegacy = !!val.platforms && typeof val.count === "number";

  if (!hasSpecs && !hasLegacy) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide problemSpecs or platforms+count",
    });
    return;
  }

  if (hasLegacy && !(val.platforms!.codeforces || val.platforms!.atcoder)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select at least one platform",
    });
  }
});
