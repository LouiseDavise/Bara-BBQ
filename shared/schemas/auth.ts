// Request bodies for sign-in, PIN switch and device registration, shared by the API and the
// staff app's forms. Strict objects: unknown fields are refused.
import { z } from 'zod'
import { STAFF_LOCALES } from '../locales.js'

export const loginBody = z.strictObject({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
})

export const pinBody = z.strictObject({
  staffId: z.string().min(1).max(64),
  pin: z.string().regex(/^\d{4,6}$/),
})

export const demoLoginBody = z.strictObject({
  staffId: z.string().min(1).max(64),
})

export const meUpdateBody = z.strictObject({
  language: z.enum(STAFF_LOCALES),
})

export const deviceRegisterBody = z.strictObject({
  name: z.string().trim().min(1).max(40),
  kind: z.enum(['pos', 'kds', 'host', 'waiter']),
  station: z.string().trim().min(1).max(32).nullable(),
  language: z.enum(STAFF_LOCALES).optional(),
})

export type LoginBody = z.infer<typeof loginBody>
export type DeviceRegisterBody = z.infer<typeof deviceRegisterBody>
