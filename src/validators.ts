import { z } from 'zod';

export const amountSchema = z.number()
  .min(0, "Beloppet kan inte vara negativt")
  .max(1000000000, "Beloppet är orimligt stort");

export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Kontonamn kan inte vara tomt").max(100, "Kontonamn för långt"),
  type: z.enum(['shared', 'person']),
  transferMethod: z.enum(['swish', 'transfer', 'none']).optional()
});

export const intervalSchema = z.enum(['all', 'odd', 'even', 'custom']);

export const billBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Räkningsnamn kan inte vara tomt").max(100, "Räkningsnamn för långt"),
  defaultAmount: amountSchema,
  interval: intervalSchema,
  customMonths: z.array(z.number().min(1).max(12)).optional(),
  warnIfZero: z.boolean().optional(),
  isLoan: z.boolean().optional(),
  totalDebt: amountSchema.optional(),
  isArchived: z.boolean().optional()
});

export const billSchema = billBaseSchema.extend({
  accountId: z.string().min(1, "Ett konto måste väljas"),
  splitType: z.string().min(1)
});

export const privateBillSchema = billBaseSchema.extend({
  userId: z.string().min(1),
  isShared: z.boolean().optional()
});

// Helper functions for easy validation without throwing
export const safeParseAmount = (val: unknown) => amountSchema.safeParse(val);
export const safeParseAccount = (val: unknown) => accountSchema.safeParse(val);
export const safeParseBill = (val: unknown) => billSchema.safeParse(val);
export const safeParsePrivateBill = (val: unknown) => privateBillSchema.safeParse(val);
