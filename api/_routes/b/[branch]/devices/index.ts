// POST /api/b/:branch/devices: a manager registers the browser they're using (POS tablet, KDS
// screen, host stand) to this branch. The device then always knows its branch, and staff
// switch user on it with their PIN.
import { Timestamp } from 'firebase-admin/firestore'
import { primaryRoleIn } from '../../../../../shared/permissions.js'
import { deviceRegisterBody } from '../../../../../shared/schemas/auth.js'
import type { DeviceDoc } from '../../../../../shared/types/staff.js'
import { randomToken } from '../../../../../lib/auth/crypto.js'
import { cookie, deviceMaxAge, DEVICE_COOKIE, signDevice } from '../../../../../lib/auth/session.js'
import { deviceSecretHash } from '../../../../../lib/auth/staff.js'
import { appendAudit } from '../../../../../lib/db/audit.js'
import { groupCol } from '../../../../../lib/db/paths.js'
import { badRequest } from '../../../../../lib/http/errors.js'
import { json } from '../../../../../lib/http/respond.js'
import { route } from '../../../../../lib/http/route.js'

export const POST = route({ auth: 'staff', branch: 'url', permission: 'devices.manage', body: deviceRegisterBody }, async (ctx) => {
  const branch = ctx.branch!
  const { name, kind, station, language } = ctx.body
  if (station && !branch.settings.stations.some((s) => s.id === station)) throw badRequest(`Unknown station "${station}".`)

  const ref = groupCol<DeviceDoc>('devices').doc()
  const secret = randomToken(24)
  const device: DeviceDoc = {
    id: ref.id,
    branchId: branch.id,
    kind,
    name,
    station: kind === 'kds' ? station : null,
    language: language ?? ctx.staff!.language,
    secretHash: await deviceSecretHash(secret),
    registeredBy: ctx.staff!.id,
    registeredAt: Timestamp.fromDate(ctx.now),
    lastSeenAt: null,
    revokedAt: null,
    origin: 'app',
  }
  await ref.create(device)
  await appendAudit({
    branchId: branch.id,
    actor: { staffId: ctx.staff!.id, name: ctx.staff!.name, role: primaryRoleIn(ctx.access!, branch.id) },
    action: 'device.register',
    target: { type: 'device', id: ref.id },
    after: { name, kind, station: device.station },
    ip: ctx.ip,
  })
  const token = await signDevice({ deviceId: ref.id, branchId: branch.id, secret })
  return json(
    { device: { id: device.id, name, kind, station: device.station, branchId: branch.id } },
    { status: 201, cookies: [cookie(DEVICE_COOKIE, token, deviceMaxAge())] },
  )
})
