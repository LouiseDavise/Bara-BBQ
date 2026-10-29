// The English files define the shape; every other language file is typed against it, so a
// missing or extra key is a compile error.
import type guestEn from './guest/en.js'
import type staffEn from './staff/en.js'

type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> }

export type GuestMessages = DeepString<typeof guestEn>
export type StaffMessages = DeepString<typeof staffEn>

/** Replaces {name} placeholders: fill('Opens at {time}', { time: '17:30' }). */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))
}
