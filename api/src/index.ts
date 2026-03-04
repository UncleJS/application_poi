import { Elysia } from 'elysia'
import { SignJWT, jwtVerify } from 'jose'
import * as mariadb from 'mariadb'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type Dict = Record<string, unknown>
type UserRole = 'admin' | 'user'
type AccessUser = { id: string; username: string; role: UserRole }

const requiredEnv = (key: string) => {
  const value = process.env[key]
  if (!value || value.trim() === '' || value.includes('change_me')) {
    throw new Error(`Missing or insecure required env var: ${key}`)
  }
  return value
}

const env = {
  dbHost: process.env.DB_HOST ?? 'poi-db',
  dbPort: Number(process.env.DB_PORT ?? 3306),
  dbName: process.env.DB_NAME ?? 'poi',
  dbUser: process.env.DB_USER ?? 'poi_app',
  dbPassword: requiredEnv('DB_PASSWORD'),
  jwtAccessSecret: requiredEnv('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: requiredEnv('JWT_REFRESH_SECRET'),
  jwtIssuer: process.env.JWT_ISSUER ?? 'poi-local',
  jwtAudience: process.env.JWT_AUDIENCE ?? 'poi-users',
  adminUser: process.env.ADMIN_USER ?? 'admin',
  adminPassword: requiredEnv('ADMIN_PASSWORD'),
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_BYTES ?? 20971520),
  photoMaxPerPoi: Number(process.env.PHOTO_MAX_PER_POI ?? 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:9010',
  docsAuthEnabled: (process.env.DOCS_AUTH_ENABLED ?? 'false').toLowerCase() === 'true',
  docsAuthUser: process.env.DOCS_AUTH_USER ?? 'admin',
  docsAuthPass: process.env.DOCS_AUTH_PASS ?? 'change_me_docs_password'
}

const openApiPath = join(process.cwd(), 'openapi.json')
const openApiJson = readFileSync(openApiPath, 'utf8')

const accessKey = new TextEncoder().encode(env.jwtAccessSecret)
const refreshKey = new TextEncoder().encode(env.jwtRefreshSecret)

const pool = mariadb.createPool({
  host: env.dbHost,
  port: env.dbPort,
  user: env.dbUser,
  password: env.dbPassword,
  database: env.dbName,
  connectionLimit: 8
})

const docsHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>POI API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" />
    <style>body { margin: 0; }</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui'
      });
    </script>
  </body>
</html>`

const responseHeaders = {
  'access-control-allow-origin': env.corsOrigin,
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'Content-Type,Authorization',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin'
}

const randomId = () => crypto.randomUUID()
const toBool = (value?: string) => value === '1' || value === 'true'

const normalizeRows = <T>(rows: unknown): T[] => {
  if (!Array.isArray(rows)) return []
  return rows as T[]
}

const parseBasicAuth = (header?: string) => {
  if (!header?.startsWith('Basic ')) return null
  const base = header.slice('Basic '.length)
  const plain = Buffer.from(base, 'base64').toString('utf8')
  const idx = plain.indexOf(':')
  if (idx === -1) return null
  return { user: plain.slice(0, idx), pass: plain.slice(idx + 1) }
}

const verifyDocsAuth = (header?: string) => {
  if (!env.docsAuthEnabled) return true
  const parsed = parseBasicAuth(header)
  if (!parsed) return false
  return parsed.user === env.docsAuthUser && parsed.pass === env.docsAuthPass
}

const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${derived}`
}

const verifyPassword = (password: string, hashed: string) => {
  const parts = hashed.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = parts[1]
  const digest = parts[2]
  const candidate = scryptSync(password, salt, 64)
  const target = Buffer.from(digest, 'hex')
  if (target.length !== candidate.length) return false
  return timingSafeEqual(candidate, target)
}

const issueTokens = async (user: AccessUser) => {
  const refreshJti = randomId()
  const accessToken = await new SignJWT({
    typ: 'access',
    jti: randomId(),
    role: user.role,
    username: user.username,
    sub: user.id
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(env.jwtIssuer)
    .setAudience(env.jwtAudience)
    .setExpirationTime('15m')
    .sign(accessKey)

  const refreshToken = await new SignJWT({
    typ: 'refresh',
    jti: refreshJti,
    role: user.role,
    username: user.username,
    sub: user.id
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(env.jwtIssuer)
    .setAudience(env.jwtAudience)
    .setExpirationTime('7d')
    .sign(refreshKey)

  return { accessToken, refreshToken, refreshJti, tokenType: 'Bearer', expiresInSeconds: 900 }
}

const requireAccess = async (authorization?: string): Promise<AccessUser | null> => {
  if (!authorization?.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length)
  try {
    const verified = await jwtVerify(token, accessKey, {
      issuer: env.jwtIssuer,
      audience: env.jwtAudience
    })
    const payload = verified.payload
    if (payload.typ !== 'access') return null
    const id = String(payload.sub ?? '')
    const username = String(payload.username ?? '')
    const role = String(payload.role ?? '') as UserRole
    if (!id || !username || (role !== 'admin' && role !== 'user')) return null
    return { id, username, role }
  } catch {
    return null
  }
}

const requireAdmin = (user: AccessUser | null, set: { status: number }) => {
  if (!user || user.role !== 'admin') {
    set.status = 403
    return false
  }
  return true
}

const dbUnavailable = (set: { status: number }) => {
  set.status = 503
  return { error: 'Database unavailable' }
}

const withConn = async <T>(
  set: { status: number },
  callback: (conn: mariadb.PoolConnection) => Promise<T>
): Promise<T | { error: string }> => {
  let conn: mariadb.PoolConnection | undefined
  try {
    conn = await pool.getConnection()
    return await callback(conn)
  } catch (error) {
    console.error(error)
    return dbUnavailable(set)
  } finally {
    conn?.release()
  }
}

const detectImageMime = (bytes: Uint8Array) => {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

const sanitizeFilename = (name: string) => {
  const cleaned = name.replace(/[^a-zA-Z0-9._ -]/g, '_').trim()
  if (!cleaned) return 'photo'
  return cleaned.slice(0, 120)
}

const isAllowedRole = (value: string): value is UserRole => value === 'admin' || value === 'user'

const userCanWritePoi = async (conn: mariadb.PoolConnection, poiId: string, user: AccessUser) => {
  if (user.role === 'admin') return true
  const rows = normalizeRows<Record<string, unknown>>(await conn.query(
    'SELECT owner_user_id FROM pois WHERE id = ? AND archived_at IS NULL LIMIT 1',
    [poiId]
  ))
  return rows.length > 0 && String(rows[0].owner_user_id ?? '') === user.id
}

const userCanReadPoi = async (conn: mariadb.PoolConnection, poiId: string, user: AccessUser) => {
  if (user.role === 'admin') return true
  const rows = normalizeRows<Record<string, unknown>>(await conn.query(
    `SELECT p.id
     FROM pois p
     LEFT JOIN poi_shares s ON s.poi_id = p.id AND s.shared_with_user_id = ? AND s.archived_at IS NULL
     WHERE p.id = ? AND p.archived_at IS NULL AND (p.owner_user_id = ? OR s.id IS NOT NULL)
     LIMIT 1`,
    [user.id, poiId, user.id]
  ))
  return rows.length > 0
}

type AttemptState = { count: number; firstAt: number }
const loginAttempts = new Map<string, AttemptState>()

const getIpFromHeaders = (headers: Record<string, string | undefined>) => {
  const xff = headers['x-forwarded-for']
  if (xff) return xff.split(',')[0].trim()
  return headers['x-real-ip'] ?? 'unknown'
}

const isLoginRateLimited = (ip: string) => {
  const now = Date.now()
  const state = loginAttempts.get(ip)
  const windowMs = 60_000
  if (!state || now - state.firstAt > windowMs) {
    loginAttempts.set(ip, { count: 1, firstAt: now })
    return false
  }
  state.count += 1
  loginAttempts.set(ip, state)
  return state.count > 5
}

const ensureAdminUser = async () => {
  let conn: mariadb.PoolConnection | undefined
  try {
    conn = await pool.getConnection()
    const adminRows = normalizeRows<Record<string, unknown>>(await conn.query(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [env.adminUser]
    ))
    const passHash = hashPassword(env.adminPassword)
    let adminId = ''
    if (adminRows.length === 0) {
      adminId = randomId()
      await conn.query(
        'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
        [adminId, env.adminUser, passHash, 'admin']
      )
    } else {
      adminId = String(adminRows[0].id)
      await conn.query(
        'UPDATE users SET role = ?, password_hash = ?, archived_at = NULL WHERE id = ?',
        ['admin', passHash, adminId]
      )
    }
    await conn.query('UPDATE pois SET owner_user_id = ? WHERE owner_user_id IS NULL', [adminId])
  } catch (error) {
    console.error('Failed to ensure admin user', error)
  } finally {
    conn?.release()
  }
}

const app = new Elysia()
  .onRequest(({ set }) => {
    Object.entries(responseHeaders).forEach(([k, v]) => {
      set.headers[k] = v
    })
  })
  .options('*', ({ set }) => {
    set.status = 204
    return ''
  })
  .get('/health', () => ({ status: 'ok' }))
  .get('/ready', async ({ set }) => {
    return withConn(set, async (conn) => {
      await conn.query('SELECT 1')
      return { status: 'ready' }
    })
  })
  .get('/openapi.json', ({ headers, set }) => {
    if (!verifyDocsAuth(headers.authorization)) {
      set.status = 401
      set.headers['www-authenticate'] = 'Basic realm="POI Docs"'
      return { error: 'Unauthorized docs access' }
    }
    return new Response(openApiJson, {
      headers: { 'content-type': 'application/json' }
    })
  })
  .get('/docs', ({ headers, set }) => {
    if (!verifyDocsAuth(headers.authorization)) {
      set.status = 401
      set.headers['www-authenticate'] = 'Basic realm="POI Docs"'
      return { error: 'Unauthorized docs access' }
    }
    return new Response(docsHtml, {
      headers: { 'content-type': 'text/html; charset=utf-8' }
    })
  })
  .post('/auth/login', async ({ body, set, headers }) => {
    const ip = getIpFromHeaders(headers as Record<string, string | undefined>)
    if (isLoginRateLimited(ip)) {
      set.status = 429
      return { error: 'Too many login attempts, wait 60 seconds' }
    }

    const payload = body as Dict
    const username = String(payload.username ?? '').trim()
    const password = String(payload.password ?? '')

    if (!username || !password) {
      set.status = 400
      return { error: 'username and password are required' }
    }

    return withConn(set, async (conn) => {
      const rows = normalizeRows<Record<string, unknown>>(await conn.query(
        `SELECT id, username, password_hash, role
         FROM users WHERE username = ? AND archived_at IS NULL LIMIT 1`,
        [username]
      ))
      if (rows.length === 0 || !verifyPassword(password, String(rows[0].password_hash ?? ''))) {
        set.status = 401
        return { error: 'Invalid credentials' }
      }

      const role = String(rows[0].role ?? 'user')
      if (!isAllowedRole(role)) {
        set.status = 401
        return { error: 'Invalid credentials' }
      }
      const user: AccessUser = {
        id: String(rows[0].id),
        username: String(rows[0].username),
        role
      }
      const issued = await issueTokens(user)
      await conn.query(
        `INSERT INTO refresh_tokens (id, jti, user_name, expires_at)
         VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY))`,
        [randomId(), issued.refreshJti, user.username]
      )
      return {
        accessToken: issued.accessToken,
        refreshToken: issued.refreshToken,
        tokenType: issued.tokenType,
        expiresInSeconds: issued.expiresInSeconds,
        user
      }
    })
  })
  .post('/auth/refresh', async ({ body, set }) => {
    const payload = body as Dict
    const token = String(payload.refreshToken ?? '')
    if (!token) {
      set.status = 400
      return { error: 'refreshToken is required' }
    }
    try {
      const verified = await jwtVerify(token, refreshKey, {
        issuer: env.jwtIssuer,
        audience: env.jwtAudience
      })
      if (verified.payload.typ !== 'refresh') {
        set.status = 401
        return { error: 'Invalid refresh token' }
      }

      const refreshJti = String(verified.payload.jti ?? '')
      const username = String(verified.payload.username ?? '')
      const userId = String(verified.payload.sub ?? '')
      if (!refreshJti || !username || !userId) {
        set.status = 401
        return { error: 'Invalid refresh token' }
      }

      return withConn(set, async (conn) => {
        const rows = normalizeRows<Record<string, unknown>>(await conn.query(
          `SELECT id FROM refresh_tokens
           WHERE jti = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()
           LIMIT 1`,
          [refreshJti]
        ))
        if (rows.length === 0) {
          set.status = 401
          return { error: 'Refresh token revoked or expired' }
        }

        const userRows = normalizeRows<Record<string, unknown>>(await conn.query(
          'SELECT id, username, role FROM users WHERE id = ? AND archived_at IS NULL LIMIT 1',
          [userId]
        ))
        if (userRows.length === 0) {
          set.status = 401
          return { error: 'User not available' }
        }
        const role = String(userRows[0].role ?? 'user')
        if (!isAllowedRole(role)) {
          set.status = 401
          return { error: 'User role invalid' }
        }

        await conn.query('UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE jti = ? AND revoked_at IS NULL', [refreshJti])

        const user: AccessUser = {
          id: String(userRows[0].id),
          username: String(userRows[0].username),
          role
        }
        const issued = await issueTokens(user)
        await conn.query(
          `INSERT INTO refresh_tokens (id, jti, user_name, expires_at)
           VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY))`,
          [randomId(), issued.refreshJti, username]
        )

        return {
          accessToken: issued.accessToken,
          refreshToken: issued.refreshToken,
          tokenType: issued.tokenType,
          expiresInSeconds: issued.expiresInSeconds,
          user
        }
      })
    } catch {
      set.status = 401
      return { error: 'Invalid refresh token' }
    }
  })
  .get('/api/admin/users', async ({ headers, query, set }) => {
    const user = await requireAccess(headers.authorization)
    if (!requireAdmin(user, set)) return { error: 'Forbidden' }
    const filters = query as Record<string, string>
    return withConn(set, async (conn) => {
      const includeArchived = toBool(filters.includeArchived)
      const rows = normalizeRows<Record<string, unknown>>(await conn.query(
        `SELECT id, username, role, created_at, archived_at
         FROM users
         ${includeArchived ? '' : 'WHERE archived_at IS NULL'}
         ORDER BY created_at DESC`
      ))
      return rows
    })
  })
  .post('/api/admin/users', async ({ headers, body, set }) => {
    const user = await requireAccess(headers.authorization)
    if (!requireAdmin(user, set)) return { error: 'Forbidden' }
    const payload = body as Dict
    const username = String(payload.username ?? '').trim()
    const password = String(payload.password ?? '')
    const role = String(payload.role ?? 'user')
    if (!username || !password || !isAllowedRole(role)) {
      set.status = 400
      return { error: 'username, password, and valid role are required' }
    }
    return withConn(set, async (conn) => {
      const existing = normalizeRows<Record<string, unknown>>(await conn.query(
        'SELECT id, archived_at FROM users WHERE username = ? LIMIT 1',
        [username]
      ))
      if (existing.length > 0) {
        if (existing[0].archived_at) {
          await conn.query('UPDATE users SET password_hash = ?, role = ?, archived_at = NULL WHERE id = ?', [
            hashPassword(password),
            role,
            existing[0].id
          ])
          return { id: existing[0].id, restored: true }
        }
        set.status = 409
        return { error: 'Username already exists' }
      }
      const id = randomId()
      await conn.query(
        'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
        [id, username, hashPassword(password), role]
      )
      set.status = 201
      return { id }
    })
  })
  .patch('/api/admin/users/:id', async ({ headers, params, body, set }) => {
    const user = await requireAccess(headers.authorization)
    if (!requireAdmin(user, set)) return { error: 'Forbidden' }
    const payload = body as Dict
    const nextRole = payload.role === undefined ? null : String(payload.role)
    const nextPassword = payload.password === undefined ? null : String(payload.password)
    if (nextRole !== null && !isAllowedRole(nextRole)) {
      set.status = 400
      return { error: 'Invalid role' }
    }
    return withConn(set, async (conn) => {
      const rows = normalizeRows<Record<string, unknown>>(await conn.query(
        'SELECT id FROM users WHERE id = ? LIMIT 1',
        [params.id]
      ))
      if (rows.length === 0) {
        set.status = 404
        return { error: 'User not found' }
      }
      await conn.query(
        `UPDATE users
         SET role = COALESCE(?, role),
             password_hash = COALESCE(?, password_hash)
         WHERE id = ?`,
        [nextRole, nextPassword ? hashPassword(nextPassword) : null, params.id]
      )
      return { updated: true }
    })
  })
  .delete('/api/admin/users/:id', async ({ headers, params, set }) => {
    const user = await requireAccess(headers.authorization)
    if (!requireAdmin(user, set)) return { error: 'Forbidden' }
    return withConn(set, async (conn) => {
      const result = await conn.query(
        'UPDATE users SET archived_at = UTC_TIMESTAMP() WHERE id = ? AND archived_at IS NULL',
        [params.id]
      )
      if (!result.affectedRows) {
        set.status = 404
        return { error: 'User not found' }
      }
      return { archived: true }
    })
  })
  .post('/api/admin/users/:id/restore', async ({ headers, params, set }) => {
    const user = await requireAccess(headers.authorization)
    if (!requireAdmin(user, set)) return { error: 'Forbidden' }
    return withConn(set, async (conn) => {
      const result = await conn.query(
        'UPDATE users SET archived_at = NULL WHERE id = ? AND archived_at IS NOT NULL',
        [params.id]
      )
      if (!result.affectedRows) {
        set.status = 404
        return { error: 'User not found or not archived' }
      }
      return { restored: true }
    })
  })
  .get('/api/pois', async ({ query, set, headers }) => {
    const user = await requireAccess(headers.authorization)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    const filters = query as Record<string, string>
    return withConn(set, async (conn) => {
      const where: string[] = []
      const params: unknown[] = []

      const includeArchived = toBool(filters.includeArchived)
      if (!includeArchived) where.push('p.archived_at IS NULL')
      if (filters.category) {
        where.push('p.category = ?')
        params.push(filters.category)
      }
      if (filters.q) {
        where.push('(p.name LIKE ? OR p.description LIKE ?)')
        params.push(`%${filters.q}%`, `%${filters.q}%`)
      }

      if (user.role !== 'admin') {
        where.push('(p.owner_user_id = ? OR s.id IS NOT NULL)')
        params.push(user.id)
      }

      const scope = String(filters.scope ?? 'all')
      if (scope === 'mine') {
        where.push('p.owner_user_id = ?')
        params.push(user.id)
      } else if (scope === 'shared') {
        where.push('s.id IS NOT NULL')
      }

      const limit = Math.min(Math.max(Number(filters.limit ?? 200), 1), 500)
      const sql = `
        SELECT
          p.id, p.owner_user_id, u.username AS owner_username,
          p.name, p.description, p.category, p.lat, p.lng,
          p.created_at, p.updated_at, p.archived_at,
          CASE WHEN p.owner_user_id = ? THEN TRUE ELSE FALSE END AS owned_by_me,
          CASE WHEN s.id IS NOT NULL THEN TRUE ELSE FALSE END AS shared_with_me
        FROM pois p
        JOIN users u ON u.id = p.owner_user_id
        LEFT JOIN poi_shares s ON s.poi_id = p.id AND s.shared_with_user_id = ? AND s.archived_at IS NULL
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY p.created_at DESC
        LIMIT ?
      `

      return normalizeRows<Record<string, unknown>>(await conn.query(sql, [user.id, user.id, ...params, limit]))
    })
  })
  .get('/api/pois/:id', async ({ params, set, headers }) => {
    const user = await requireAccess(headers.authorization)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    return withConn(set, async (conn) => {
      const canRead = await userCanReadPoi(conn, params.id, user)
      if (!canRead) {
        set.status = 404
        return { error: 'POI not found' }
      }
      const rows = normalizeRows<Record<string, unknown>>(await conn.query(
        `SELECT p.id, p.owner_user_id, u.username AS owner_username,
                p.name, p.description, p.category, p.lat, p.lng,
                p.created_at, p.updated_at, p.archived_at
         FROM pois p
         JOIN users u ON u.id = p.owner_user_id
         WHERE p.id = ? LIMIT 1`,
        [params.id]
      ))
      if (rows.length === 0) {
        set.status = 404
        return { error: 'POI not found' }
      }
      const photos = normalizeRows<Record<string, unknown>>(await conn.query(
        `SELECT id, filename, mime_type, size_bytes, created_at, archived_at
         FROM poi_photos WHERE poi_id = ? ORDER BY created_at DESC`,
        [params.id]
      ))
      const shares = normalizeRows<Record<string, unknown>>(await conn.query(
        `SELECT s.id, s.shared_with_user_id, u.username, s.created_at, s.archived_at
         FROM poi_shares s
         JOIN users u ON u.id = s.shared_with_user_id
         WHERE s.poi_id = ?
         ORDER BY s.created_at DESC`,
        [params.id]
      ))
      const ownerUserId = String(rows[0].owner_user_id ?? '')
      return {
        ...rows[0],
        photos,
        shares,
        canShare: user.role === 'admin' || ownerUserId === user.id,
        canEdit: user.role === 'admin' || ownerUserId === user.id
      }
    })
  })
  .post('/api/pois/:id/shares', async ({ params, headers, body, set }) => {
    const user = await requireAccess(headers.authorization)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    const payload = body as Dict
    const username = String(payload.username ?? '').trim()
    if (!username) {
      set.status = 400
      return { error: 'username is required' }
    }
    return withConn(set, async (conn) => {
      const canWrite = await userCanWritePoi(conn, params.id, user)
      if (!canWrite) {
        set.status = 403
        return { error: 'Forbidden' }
      }
      const targetRows = normalizeRows<Record<string, unknown>>(await conn.query(
        'SELECT id FROM users WHERE username = ? AND archived_at IS NULL LIMIT 1',
        [username]
      ))
      if (targetRows.length === 0) {
        set.status = 404
        return { error: 'User not found' }
      }
      const sharedWithUserId = String(targetRows[0].id)
      await conn.query(
        `INSERT INTO poi_shares (id, poi_id, shared_with_user_id, archived_at)
         VALUES (?, ?, ?, NULL)
         ON DUPLICATE KEY UPDATE archived_at = NULL`,
        [randomId(), params.id, sharedWithUserId]
      )
      return { shared: true }
    })
  })
  .delete('/api/pois/:id/shares/:userId', async ({ params, headers, set }) => {
    const user = await requireAccess(headers.authorization)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    return withConn(set, async (conn) => {
      const canWrite = await userCanWritePoi(conn, params.id, user)
      if (!canWrite) {
        set.status = 403
        return { error: 'Forbidden' }
      }
      const result = await conn.query(
        `UPDATE poi_shares
         SET archived_at = UTC_TIMESTAMP()
         WHERE poi_id = ? AND shared_with_user_id = ? AND archived_at IS NULL`,
        [params.id, params.userId]
      )
      if (!result.affectedRows) {
        set.status = 404
        return { error: 'Share not found' }
      }
      return { revoked: true }
    })
  })
  .post('/api/pois', async ({ body, headers, set }) => {
    const user = await requireAccess(headers.authorization)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    const payload = body as Dict
    const name = String(payload.name ?? '').trim()
    const description = payload.description === undefined || payload.description === null
      ? ''
      : String(payload.description).trim()
    const category = String(payload.category ?? '').trim()
    const lat = Number(payload.lat)
    const lng = Number(payload.lng)
    if (!name || !category) {
      set.status = 400
      return { error: 'name and category are required' }
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      set.status = 400
      return { error: 'Invalid coordinates' }
    }

    return withConn(set, async (conn) => {
      const id = randomId()
      await conn.query(
        `INSERT INTO pois (id, owner_user_id, name, description, category, lat, lng, location)
         VALUES (?, ?, ?, ?, ?, ?, ?, ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326))`,
        [id, user.id, name, description, category, lat, lng, lng, lat]
      )
      set.status = 201
      return { id }
    })
  })
  .patch('/api/pois/:id', async ({ body, params, headers, set }) => {
    const user = await requireAccess(headers.authorization)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    const payload = body as Dict
    return withConn(set, async (conn) => {
      const canWrite = await userCanWritePoi(conn, params.id, user)
      if (!canWrite) {
        set.status = 403
        return { error: 'Forbidden' }
      }
      const existingRows = normalizeRows<Record<string, unknown>>(await conn.query(
        'SELECT lat, lng FROM pois WHERE id = ? AND archived_at IS NULL LIMIT 1',
        [params.id]
      ))
      if (existingRows.length === 0) {
        set.status = 404
        return { error: 'POI not found' }
      }
      const current = existingRows[0]
      const lat = payload.lat === undefined ? Number(current.lat) : Number(payload.lat)
      const lng = payload.lng === undefined ? Number(current.lng) : Number(payload.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        set.status = 400
        return { error: 'Invalid coordinates' }
      }

      const result = await conn.query(
        `UPDATE pois
         SET name = COALESCE(?, name),
             description = COALESCE(?, description),
             category = COALESCE(?, category),
             lat = ?,
             lng = ?,
             location = ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326)
         WHERE id = ? AND archived_at IS NULL`,
        [payload.name, payload.description, payload.category, lat, lng, lng, lat, params.id]
      )
      if (!result.affectedRows) {
        set.status = 404
        return { error: 'POI not found' }
      }
      return { updated: true }
    })
  })
  .delete('/api/pois/:id', async ({ params, headers, set }) => {
    const user = await requireAccess(headers.authorization)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    return withConn(set, async (conn) => {
      const canWrite = await userCanWritePoi(conn, params.id, user)
      if (!canWrite) {
        set.status = 403
        return { error: 'Forbidden' }
      }
      const result = await conn.query('UPDATE pois SET archived_at = UTC_TIMESTAMP() WHERE id = ? AND archived_at IS NULL', [params.id])
      if (!result.affectedRows) {
        set.status = 404
        return { error: 'POI not found' }
      }
      await conn.query('UPDATE poi_photos SET archived_at = UTC_TIMESTAMP() WHERE poi_id = ? AND archived_at IS NULL', [params.id])
      return { archived: true }
    })
  })
  .post('/api/pois/:id/restore', async ({ params, headers, set }) => {
    const user = await requireAccess(headers.authorization)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    return withConn(set, async (conn) => {
      const canWrite = await userCanWritePoi(conn, params.id, user)
      if (!canWrite) {
        set.status = 403
        return { error: 'Forbidden' }
      }
      const result = await conn.query('UPDATE pois SET archived_at = NULL WHERE id = ? AND archived_at IS NOT NULL', [params.id])
      if (!result.affectedRows) {
        set.status = 404
        return { error: 'POI not found or not archived' }
      }
      return { restored: true }
    })
  })
  .post('/api/pois/:id/photos', async ({ params, request, headers, set }) => {
    const user = await requireAccess(headers.authorization)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    const form = await request.formData()
    const maybeFile = form.get('photo')
    if (!(maybeFile instanceof File)) {
      set.status = 400
      return { error: 'photo file is required' }
    }
    if (maybeFile.size > env.uploadMaxBytes) {
      set.status = 413
      return { error: 'File exceeds upload limit' }
    }

    const rawBytes = new Uint8Array(await maybeFile.arrayBuffer())
    const detectedMime = detectImageMime(rawBytes)
    if (!detectedMime) {
      set.status = 415
      return { error: 'Unsupported media type' }
    }

    return withConn(set, async (conn) => {
      const canWrite = await userCanWritePoi(conn, params.id, user)
      if (!canWrite) {
        set.status = 403
        return { error: 'Forbidden' }
      }
      const poiRows = normalizeRows<Record<string, unknown>>(await conn.query(
        'SELECT id FROM pois WHERE id = ? AND archived_at IS NULL LIMIT 1',
        [params.id]
      ))
      if (poiRows.length === 0) {
        set.status = 404
        return { error: 'POI not found' }
      }

      const countRows = normalizeRows<Record<string, unknown>>(await conn.query(
        'SELECT COUNT(*) AS total FROM poi_photos WHERE poi_id = ? AND archived_at IS NULL',
        [params.id]
      ))
      const count = Number(countRows[0]?.total ?? 0)
      if (count >= env.photoMaxPerPoi) {
        set.status = 409
        return { error: 'Photo limit reached for this POI' }
      }

      const id = randomId()
      const safeName = sanitizeFilename(maybeFile.name || 'photo')
      await conn.query(
        `INSERT INTO poi_photos (id, poi_id, filename, mime_type, size_bytes, image_blob)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, params.id, safeName, detectedMime, rawBytes.byteLength, Buffer.from(rawBytes)]
      )

      set.status = 201
      return { id }
    })
  })
  .get('/api/photos/:id', async ({ params, set }) => {
    return withConn(set, async (conn) => {
      const rows = normalizeRows<Record<string, unknown>>(await conn.query(
        `SELECT filename, mime_type, image_blob
         FROM poi_photos WHERE id = ? AND archived_at IS NULL LIMIT 1`,
        [params.id]
      ))
      if (rows.length === 0) {
        set.status = 404
        return { error: 'Photo not found' }
      }

      const row = rows[0]
      const filename = sanitizeFilename(String(row.filename ?? 'photo'))
      return new Response(row.image_blob as BodyInit, {
        headers: {
          'content-type': String(row.mime_type),
          'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'cache-control': 'public, max-age=86400'
        }
      })
    })
  })
  .delete('/api/photos/:id', async ({ params, headers, set }) => {
    const user = await requireAccess(headers.authorization)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    return withConn(set, async (conn) => {
      const rows = normalizeRows<Record<string, unknown>>(await conn.query(
        `SELECT p.id as poi_id
         FROM poi_photos ph
         JOIN pois p ON p.id = ph.poi_id
         WHERE ph.id = ? AND ph.archived_at IS NULL`,
        [params.id]
      ))
      if (rows.length === 0) {
        set.status = 404
        return { error: 'Photo not found' }
      }
      const canWrite = await userCanWritePoi(conn, String(rows[0].poi_id), user)
      if (!canWrite) {
        set.status = 403
        return { error: 'Forbidden' }
      }
      const result = await conn.query('UPDATE poi_photos SET archived_at = UTC_TIMESTAMP() WHERE id = ? AND archived_at IS NULL', [params.id])
      if (!result.affectedRows) {
        set.status = 404
        return { error: 'Photo not found' }
      }
      return { archived: true }
    })
  })
  .post('/api/photos/:id/restore', async ({ params, headers, set }) => {
    const user = await requireAccess(headers.authorization)
    if (!user) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    return withConn(set, async (conn) => {
      const rows = normalizeRows<Record<string, unknown>>(await conn.query(
        `SELECT p.id as poi_id
         FROM poi_photos ph
         JOIN pois p ON p.id = ph.poi_id
         WHERE ph.id = ? LIMIT 1`,
        [params.id]
      ))
      if (rows.length === 0) {
        set.status = 404
        return { error: 'Photo not found' }
      }
      const canWrite = await userCanWritePoi(conn, String(rows[0].poi_id), user)
      if (!canWrite) {
        set.status = 403
        return { error: 'Forbidden' }
      }
      const result = await conn.query('UPDATE poi_photos SET archived_at = NULL WHERE id = ? AND archived_at IS NOT NULL', [params.id])
      if (!result.affectedRows) {
        set.status = 404
        return { error: 'Photo not found or not archived' }
      }
      return { restored: true }
    })
  })
  .listen(3001)

void ensureAdminUser()

console.log(`POI API running on http://0.0.0.0:${app.server?.port}`)
