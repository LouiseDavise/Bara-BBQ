// Country defaults for tax, service charge, rounding, invoicing, tenders, messaging and more.
// Branches override any of these in Firestore (branch.settings.pricing and friends); code reads
// the merged result through shared/settings.ts, never a country code in a component.
import { indonesia } from './id.js'
import { malaysia } from './my.js'
import { singapore } from './sg.js'
import { taiwan } from './tw.js'
import type { CountryCode, CountryProfile } from './types.js'

export * from './types.js'

export const countryProfiles: Record<CountryCode, CountryProfile> = {
  TW: taiwan,
  ID: indonesia,
  MY: malaysia,
  SG: singapore,
}

export function countryProfile(code: CountryCode): CountryProfile {
  const profile = countryProfiles[code]
  if (!profile) throw new RangeError(`No country profile for ${code}.`)
  return profile
}
