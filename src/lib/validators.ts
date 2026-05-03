import { z } from "zod";

// ─── Auth Schemas ────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, "Usuario requerido")
    .max(50, "Usuario muy largo")
    .transform((v) => v.trim()),
  password: z.string().min(1, "Contraseña requerida").max(100, "Contraseña muy larga"),
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Usuario debe tener al menos 3 caracteres")
    .max(20, "Usuario debe tener máximo 20 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y guion bajo")
    .transform((v) => v.trim()),
  password: z
    .string()
    .min(4, "Contraseña debe tener al menos 4 caracteres")
    .max(64, "Contraseña muy larga"),
  referralCode: z
    .string()
    .max(20, "Código muy largo")
    .optional()
    .transform((v) => (v ? v.trim().toUpperCase() : undefined)),
  fingerprint: z.string().min(1, "Fingerprint requerido").max(200),
  turnstileToken: z.string().min(1, "Verificación requerida").max(1000),
});

// ─── User API Schemas ───────────────────────────────────────────────────────

export const redeemSchema = z.object({
  code: z
    .string()
    .min(1, "Código requerido")
    .max(20, "Código muy largo")
    .transform((v) => v.trim().toUpperCase()),
});

export const tvActivateSchema = z.object({
  code: z
    .string()
    .regex(/^\d{8}$/, "El código debe tener exactamente 8 dígitos")
    .transform((v) => v.trim()),
});

// ─── Admin API Schemas ──────────────────────────────────────────────────────

export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "Mínimo 3 caracteres")
    .max(20, "Máximo 20 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y _")
    .transform((v) => v.trim()),
  password: z.string().min(4, "Mínimo 4 caracteres").max(64),
  credits: z.number().int().min(0).max(10000).default(0),
});

export const updateCreditsSchema = z.object({
  userId: z.string().min(1, "userId requerido"),
  amount: z.number().int().min(-10000, "Mínimo -10000").max(10000, "Máximo 10000"),
  description: z.string().max(200, "Descripción muy larga").optional(),
});

// ─── Validation Helpers ──────────────────────────────────────────────────────

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    const message = firstError ? firstError.message : "Datos inválidos";
    return { success: false, error: message };
  }
  return { success: true, data: result.data };
}
