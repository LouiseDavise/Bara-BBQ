// Loads one language's messages on demand, so a page only ships the language it shows.
import type { Locale, StaffLocale } from '../../shared/locales'
import type { GuestMessages, StaffMessages } from '../i18n/types'

const guestFiles = import.meta.glob<{ default: GuestMessages }>('../i18n/guest/*.ts')
const staffFiles = import.meta.glob<{ default: StaffMessages }>('../i18n/staff/*.ts')

export async function loadGuestMessages(locale: Locale): Promise<GuestMessages> {
  return (await guestFiles[`../i18n/guest/${locale}.ts`]!()).default
}

export async function loadStaffMessages(locale: StaffLocale): Promise<StaffMessages> {
  return (await staffFiles[`../i18n/staff/${locale}.ts`]!()).default
}
