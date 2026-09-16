import { z } from 'zod';

// ============================================================================
// Contract: POST {VITE_AUTH_API_URL}/auth/login
// Source: https://api.entreprise.de9de9.dz/swagger
// ============================================================================

// ---------- request ----------
export const loginInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

// ---------- 200 ----------
/**
 * `companyId` / `companyType` are nullish on purpose: the swagger example shows
 * them populated, but a user without a company would otherwise fail the parse
 * and turn a successful login into a hard error. Widen only these two.
 */
export const authUserSchema = z.object({
  userId: z.string(),
  email: z.string(),
  role: z.string(),
  companyId: z.string().nullish(),
  companyType: z.string().nullish(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.string(), // ISO 8601
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.string(), // ISO 8601
  user: authUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

// ---------- 401 ----------
/**
 * RFC 7807 Problem Details. `looseObject` keeps any extra members; everything is
 * optional because error bodies from gateways and proxies rarely carry the full
 * set.
 *
 * Verified live against the API — a rejected login returns:
 *   { type, title: "Invalid credentials", status: 401,
 *     traceId: "00-…", code: "invalid_credentials" }
 * Note there is no `detail`, and `title` is English, so `code` is what we map to
 * a localized message. `traceId` is worth surfacing on server faults for support.
 */
export const problemDetailsSchema = z.looseObject({
  type: z.string().optional(),
  title: z.string().optional(),
  status: z.number().optional(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string().optional(),
  traceId: z.string().optional(),
});
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
