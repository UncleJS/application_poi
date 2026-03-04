import { Elysia } from 'elysia'
import { SignJWT, jwtVerify } from 'jose'
import * as mariadb from 'mariadb'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type Dict = Record<string, unknown>

const env = {
  dbHost: process.env.DB_HOST ?? 'poi-db',
  dbPort: Number(process.env.DB_PORT ?? 3306),
  dbName: process.env.DB_NAME ?? 'poi',
  dbUser: process.env.DB_USER ?? 'poi_app',
  dbPassword: process.env.DB_PASSWORD ?? '',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'change_me_access_secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change_me_refresh_secret',
  jwtIssuer: process.env.JWT_ISSUER ?? 'poi-local',
  jwtAudience: process.env.JWT_AUDIENCE ?? 'poi-users',
  adminUser: process.env.ADMIN_USER ?? 'admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin',
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
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>body { margin: 0; }</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
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
  'access-control-allow-headers': 'Content-Type,Authorization'
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

const issueTokens = async () => {
  const accessToken = await new SignJWT({ role: 'admin', typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(env.jwtIssuer)
    .setAudience(env.jwtAudience)
    .setExpirationTime('15m')
    .sign(accessKey)

  const refreshToken = await new SignJWT({ role: 'admin', typ: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(env.jwtIssuer)
    .setAudience(env.jwtAudience)
    .setExpirationTime('7d')
    .sign(refreshKey)

  return { accessToken, refreshToken, tokenType: 'Bearer', expiresInSeconds: 900 }
}

const requireAccess = async (authorization?: string) => {
  if (!authorization?.startsWith('Bearer ')) return false
  const token = authorization.slice('Bearer '.length)
  try {
    const verified = await jwtVerify(token, accessKey, {
      issuer: env.jwtIssuer,
      audience: env.jwtAudience
    })
    return verified.payload.typ === 'access'
  } catch {
    return false
  }
}

const runMigrations = async () => {
  const conn = await pool.getConnection()
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS pois (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(80) NOT NULL,
        lat DECIMAL(10,7) NOT NULL,
        lng DECIMAL(10,7) NOT NULL,
        location POINT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        archived_at TIMESTAMP NULL DEFAULT NULL,
        SPATIAL INDEX idx_location (location),
        INDEX idx_category_active (category, archived_at),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)

    await conn.query(`
      CREATE TABLE IF NOT EXISTS poi_photos (
        id CHAR(36) PRIMARY KEY,
        poi_id CHAR(36) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(80) NOT NULL,
        size_bytes INT NOT NULL,
        image_blob LONGBLOB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        archived_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_poi_photos_active (poi_id, archived_at),
        CONSTRAINT fk_poi_photos_poi FOREIGN KEY (poi_id) REFERENCES pois(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)
  } finally {
    conn.release()
  }
}

await runMigrations()

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
  .get('/ready', async () => {
    const conn = await pool.getConnection()
    try {
      await conn.query('SELECT 1')
      return { status: 'ready' }
    } finally {
      conn.release()
    }
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
  .post('/auth/login', async ({ body, set }) => {
    const payload = body as Dict
    if (payload.username !== env.adminUser || payload.password !== env.adminPassword) {
      set.status = 401
      return { error: 'Invalid credentials' }
    }
    return issueTokens()
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
      return issueTokens()
    } catch {
      set.status = 401
      return { error: 'Invalid refresh token' }
    }
  })
  .get('/api/pois', async ({ query }) => {
    const filters = query as Record<string, string>
    const conn = await pool.getConnection()
    try {
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

      if (filters.minLat && filters.maxLat) {
        where.push('p.lat BETWEEN ? AND ?')
        params.push(Number(filters.minLat), Number(filters.maxLat))
      }

      if (filters.minLng && filters.maxLng) {
        where.push('p.lng BETWEEN ? AND ?')
        params.push(Number(filters.minLng), Number(filters.maxLng))
      }

      let sql = `
        SELECT
          p.id, p.name, p.description, p.category, p.lat, p.lng,
          p.created_at, p.updated_at, p.archived_at
        FROM pois p
      `

      if (filters.lat && filters.lng && filters.radiusKm) {
        sql = `
          SELECT
            p.id, p.name, p.description, p.category, p.lat, p.lng,
            p.created_at, p.updated_at, p.archived_at,
            (6371 * ACOS(
              COS(RADIANS(?)) * COS(RADIANS(p.lat)) * COS(RADIANS(p.lng) - RADIANS(?)) +
              SIN(RADIANS(?)) * SIN(RADIANS(p.lat))
            )) AS distance_km
          FROM pois p
        `
        params.unshift(Number(filters.lat), Number(filters.lng), Number(filters.lat))
      }

      if (where.length > 0) {
        sql += ` WHERE ${where.join(' AND ')}`
      }

      if (filters.lat && filters.lng && filters.radiusKm) {
        sql += ' HAVING distance_km <= ?'
        params.push(Number(filters.radiusKm))
      }

      const limit = Math.min(Math.max(Number(filters.limit ?? 200), 1), 500)
      sql += ' ORDER BY p.created_at DESC LIMIT ?'
      params.push(limit)

      const rows = normalizeRows<Record<string, unknown>>(await conn.query(sql, params))
      return rows
    } finally {
      conn.release()
    }
  })
  .get('/api/pois/:id', async ({ params, set }) => {
    const conn = await pool.getConnection()
    try {
      const rows = normalizeRows<Record<string, unknown>>(await conn.query(
        `SELECT id, name, description, category, lat, lng, created_at, updated_at, archived_at
         FROM pois WHERE id = ? LIMIT 1`,
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

      return { ...rows[0], photos }
    } finally {
      conn.release()
    }
  })
  .post('/api/pois', async ({ body, headers, set }) => {
    if (!(await requireAccess(headers.authorization))) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    const payload = body as Dict
    const name = String(payload.name ?? '').trim()
    const description = String(payload.description ?? '').trim()
    const category = String(payload.category ?? '').trim()
    const lat = Number(payload.lat)
    const lng = Number(payload.lng)

    if (!name || !description || !category) {
      set.status = 400
      return { error: 'name, description, and category are required' }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      set.status = 400
      return { error: 'Invalid coordinates' }
    }

    const id = randomId()
    const conn = await pool.getConnection()
    try {
      await conn.query(
        `INSERT INTO pois (id, name, description, category, lat, lng, location)
         VALUES (?, ?, ?, ?, ?, ?, ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326))`,
        [id, name, description, category, lat, lng, lng, lat]
      )
      set.status = 201
      return { id }
    } finally {
      conn.release()
    }
  })
  .patch('/api/pois/:id', async ({ body, params, headers, set }) => {
    if (!(await requireAccess(headers.authorization))) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    const payload = body as Dict
    const conn = await pool.getConnection()
    try {
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

      await conn.query(
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
      return { updated: true }
    } finally {
      conn.release()
    }
  })
  .delete('/api/pois/:id', async ({ params, headers, set }) => {
    if (!(await requireAccess(headers.authorization))) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    const conn = await pool.getConnection()
    try {
      await conn.query('UPDATE pois SET archived_at = UTC_TIMESTAMP() WHERE id = ? AND archived_at IS NULL', [params.id])
      await conn.query('UPDATE poi_photos SET archived_at = UTC_TIMESTAMP() WHERE poi_id = ? AND archived_at IS NULL', [params.id])
      return { archived: true }
    } finally {
      conn.release()
    }
  })
  .post('/api/pois/:id/restore', async ({ params, headers, set }) => {
    if (!(await requireAccess(headers.authorization))) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    const conn = await pool.getConnection()
    try {
      await conn.query('UPDATE pois SET archived_at = NULL WHERE id = ? AND archived_at IS NOT NULL', [params.id])
      return { restored: true }
    } finally {
      conn.release()
    }
  })
  .post('/api/pois/:id/photos', async ({ params, request, headers, set }) => {
    if (!(await requireAccess(headers.authorization))) {
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

    const mimeAllowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!mimeAllowed.includes(maybeFile.type)) {
      set.status = 415
      return { error: 'Unsupported media type' }
    }

    const conn = await pool.getConnection()
    try {
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
      const bytes = Buffer.from(await maybeFile.arrayBuffer())
      await conn.query(
        `INSERT INTO poi_photos (id, poi_id, filename, mime_type, size_bytes, image_blob)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, params.id, maybeFile.name || 'photo', maybeFile.type, maybeFile.size, bytes]
      )

      set.status = 201
      return { id }
    } finally {
      conn.release()
    }
  })
  .get('/api/photos/:id', async ({ params, set }) => {
    const conn = await pool.getConnection()
    try {
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
      return new Response(row.image_blob as BodyInit, {
        headers: {
          'content-type': String(row.mime_type),
          'content-disposition': `inline; filename="${String(row.filename)}"`,
          'cache-control': 'public, max-age=86400'
        }
      })
    } finally {
      conn.release()
    }
  })
  .delete('/api/photos/:id', async ({ params, headers, set }) => {
    if (!(await requireAccess(headers.authorization))) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    const conn = await pool.getConnection()
    try {
      await conn.query('UPDATE poi_photos SET archived_at = UTC_TIMESTAMP() WHERE id = ? AND archived_at IS NULL', [params.id])
      return { archived: true }
    } finally {
      conn.release()
    }
  })
  .post('/api/photos/:id/restore', async ({ params, headers, set }) => {
    if (!(await requireAccess(headers.authorization))) {
      set.status = 401
      return { error: 'Unauthorized' }
    }
    const conn = await pool.getConnection()
    try {
      await conn.query('UPDATE poi_photos SET archived_at = NULL WHERE id = ? AND archived_at IS NOT NULL', [params.id])
      return { restored: true }
    } finally {
      conn.release()
    }
  })
  .listen(3001)

console.log(`POI API running on http://0.0.0.0:${app.server?.port}`)
