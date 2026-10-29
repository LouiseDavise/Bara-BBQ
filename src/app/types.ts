// What the staff app receives from the API.
import type { CountryCode } from '../../shared/country-profiles/types'
import type { LocalizedText } from '../../shared/localized'
import type { Locale, StaffLocale } from '../../shared/locales'
import type { BranchPermission, Grant, GroupPermission, GroupRole, Role } from '../../shared/permissions'
import type { Station } from '../../shared/settings'

export interface MeBranch {
  id: string
  code: string
  name: LocalizedText
  city: LocalizedText
  timeZone: string
  role: Role | null
}

export interface Me {
  id: string
  name: string
  username: string | null
  language: StaffLocale
  groupRole: GroupRole | null
  demo: boolean
  branches: MeBranch[]
}

export interface MeResponse {
  user: Me
  device: { id: string; name: string; kind: string; station: string | null; branchId: string } | null
  pinSession: boolean
}

export interface BranchContext {
  branch: {
    id: string
    code: string
    name: LocalizedText
    city: LocalizedText
    country: CountryCode
    currency: string
    timeZone: string
    languages: { enabled: Locale[]; default: Locale }
    flags: { halal: boolean; alcohol: boolean }
    stations: Station[]
    idleLockMin: number
  }
  role: Role | null
  grants: Record<BranchPermission, Grant | 'deny'>
  businessDate: string
  serverTime: string
}

export interface HqContext {
  groupRole: GroupRole | null
  grants: Record<GroupPermission, Grant | 'deny'>
  branches: { id: string; code: string; name: LocalizedText; city: LocalizedText; country: CountryCode; currency: string; timeZone: string }[]
}

export interface DemoAccounts {
  managerPin: string
  branches: { id: string; code: string; name: LocalizedText; city: LocalizedText }[]
  accounts: { staffId: string; name: string; groupRole: GroupRole | null; branchId: string | null; role: Role | null }[]
}

export interface DeviceMe {
  device: { id: string; name: string; kind: string; station: string | null; language: StaffLocale }
  branch: { id: string; code: string; name: string; timeZone: string }
  staff: { id: string; name: string; role: Role | null }[]
  signedIn: { id: string; name: string } | null
}
