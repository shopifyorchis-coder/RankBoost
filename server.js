import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import pg from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const { Pool } = pg

// const port = process.env.PORT || 8080;
const port = process.env.PORT;

if (!port) {
  throw new Error("PORT is not defined. Railway will not work.");
}

app.listen(port, "0.0.0.0", () => {
  console.log("SERVER RUNNING ON PORT:", port);
});
const distPath = path.join(__dirname, 'dist')
const indexHtmlPath = path.join(distPath, 'index.html')
const databaseUrl = process.env.DATABASE_URL || ''
const db = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost')
        ? false
        : {
            rejectUnauthorized: false,
          },
    })
  : null

const requiredEnvVars = [
  'APP_URL',
  'SHOPIFY_API_KEY',
  'SHOPIFY_API_SECRET',
  'SCOPES',
]

const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name])

if (missingEnvVars.length > 0) {
  console.warn(
    `Missing Shopify env vars: ${missingEnvVars.join(', ')}. Shopify auth routes will stay unavailable until these are set.`,
  )
}

const activeStates = new Map()
const offlineTokens = new Map()

function normalizeAppUrl() {
  return (process.env.APP_URL || '').replace(/\/+$/, '')
}

function isValidShop(shop) {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop || '')
}

function getEmbeddedAppHeaders(shop) {
  const frameAncestors = ['https://admin.shopify.com']

  if (isValidShop(shop)) {
    frameAncestors.push(`https://${shop}`)
  } else {
    frameAncestors.push('https://*.myshopify.com')
  }

  return {
    'Content-Security-Policy': `frame-ancestors ${frameAncestors.join(' ')};`,
    'X-Frame-Options': 'ALLOWALL',
  }
}

function setStateCookie(res, state) {
  res.cookie('shopify_app_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: 5 * 60 * 1000,
  })
}

function clearStateCookie(res) {
  res.clearCookie('shopify_app_state', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
  })
}

function buildAuthorizeUrl(shop, state) {
  const redirectUri = `${normalizeAppUrl()}/auth/callback`
  const url = new URL(`https://${shop}/admin/oauth/authorize`)

  url.searchParams.set('client_id', process.env.SHOPIFY_API_KEY || '')
  url.searchParams.set('scope', process.env.SCOPES || '')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)

  return url.toString()
}

function createHmacMessage(query) {
  const entries = []

  for (const [key, value] of Object.entries(query)) {
    if (key === 'hmac' || key === 'signature') {
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        entries.push(`${key}=${item}`)
      }
      continue
    }

    entries.push(`${key}=${value}`)
  }

  return entries.sort().join('&')
}

function isValidHmac(query) {
  const providedHmac = query.hmac

  if (typeof providedHmac !== 'string') {
    return false
  }

  const message = createHmacMessage(query)
  const generatedHmac = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET || '')
    .update(message)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(generatedHmac, 'utf8'),
    Buffer.from(providedHmac, 'utf8'),
  )
}

function buildEmbeddedAuthPage(targetUrl) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting to Shopify auth</title>
  </head>
  <body>
    <script>
      const target = ${JSON.stringify(targetUrl)};
      if (window.top === window.self) {
        window.location.replace(target);
      } else {
        window.top.location.href = target;
      }
    </script>
    <p>Redirecting to Shopify authentication...</p>
  </body>
</html>`
}

function renderAppHtml() {
  const html = fs.readFileSync(indexHtmlPath, 'utf8')
  const injectedTags = [
    process.env.SHOPIFY_API_KEY
      ? `<meta name="shopify-api-key" content="${process.env.SHOPIFY_API_KEY}" />`
      : '',
    '<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>',
  ]
    .filter(Boolean)
    .join('')

  return html.replace('</head>', `${injectedTags}</head>`)
}

async function ensureDatabase() {
  if (!db) {
    console.warn(
      'DATABASE_URL is not set. Shopify tokens will only persist in memory until the server restarts.',
    )
    return
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS shopify_offline_tokens (
      shop TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      scope TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function saveOfflineToken(shop, accessToken, scope) {
  if (!db) {
    offlineTokens.set(shop, accessToken)
    return
  }

  await db.query(
    `
      INSERT INTO shopify_offline_tokens (shop, access_token, scope, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (shop)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        scope = EXCLUDED.scope,
        updated_at = NOW()
    `,
    [shop, accessToken, scope || null],
  )

  offlineTokens.set(shop, accessToken)
}

async function getOfflineToken(shop) {
  if (offlineTokens.has(shop)) {
    return offlineTokens.get(shop)
  }

  if (!db) {
    return null
  }

  const result = await db.query(
    'SELECT access_token FROM shopify_offline_tokens WHERE shop = $1 LIMIT 1',
    [shop],
  )

  const token = result.rows[0]?.access_token || null

  if (token) {
    offlineTokens.set(shop, token)
  }

  return token
}

async function exchangeCodeForAccessToken(shop, code) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Shopify access token exchange failed: ${response.status} ${text}`)
  }

  return response.json()
}

app.disable('x-powered-by')
app.use(express.json())

app.get('/healthz', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/shopify/status', async (req, res) => {
  const shop = req.query.shop

  if (!isValidShop(shop)) {
    return res.status(400).json({
      connected: false,
      error: 'Missing or invalid `shop` query parameter.',
    })
  }

  try {
    const token = await getOfflineToken(shop)

    return res.json({
      connected: Boolean(token),
      shop,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      connected: false,
      error: 'Unable to read Shopify connection status.',
    })
  }
})

app.get('/auth', (req, res) => {
  const shop = req.query.shop

  if (missingEnvVars.length > 0) {
    return res.status(500).send(
      `Missing environment variables: ${missingEnvVars.join(', ')}`,
    )
  }

  if (!isValidShop(shop)) {
    return res.status(400).send('Invalid Shopify shop domain.')
  }

  const state = crypto.randomBytes(16).toString('hex')
  activeStates.set(state, {
    shop,
    createdAt: Date.now(),
  })

  setStateCookie(res, state)
  return res.redirect(buildAuthorizeUrl(shop, state))
})

app.get('/auth/callback', async (req, res) => {
  const shop = req.query.shop
  const state = req.query.state
  const code = req.query.code
  const host = req.query.host

  clearStateCookie(res)

  if (!isValidShop(shop)) {
    return res.status(400).send('Invalid Shopify shop domain.')
  }

  if (!isValidHmac(req.query)) {
    return res.status(400).send('Invalid Shopify HMAC signature.')
  }

  if (typeof state !== 'string' || !activeStates.has(state)) {
    return res.status(400).send('Invalid or expired OAuth state.')
  }

  const existingState = activeStates.get(state)
  activeStates.delete(state)

  if (existingState?.shop !== shop) {
    return res.status(400).send('Shop mismatch during OAuth callback.')
  }

  if (typeof code !== 'string') {
    return res.status(400).send('Missing Shopify authorization code.')
  }

  try {
    const tokenResponse = await exchangeCodeForAccessToken(shop, code)
    await saveOfflineToken(shop, tokenResponse.access_token, tokenResponse.scope)

    const redirectUrl = new URL(normalizeAppUrl() || `http://localhost:${port}`)
    redirectUrl.searchParams.set('shop', shop)

    if (typeof host === 'string' && host) {
      redirectUrl.searchParams.set('host', host)
    }

    return res.redirect(redirectUrl.toString())
  } catch (error) {
    console.error(error)
    return res.status(500).send('Unable to finish Shopify authentication.')
  }
})

app.use((req, res, next) => {
  const shop = typeof req.query.shop === 'string' ? req.query.shop : ''
  const headers = getEmbeddedAppHeaders(shop)

  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value)
  })

  next()
})

app.use(express.static(distPath))

app.get(/.*/, async (req, res) => {
  const shop = typeof req.query.shop === 'string' ? req.query.shop : ''
  const host = typeof req.query.host === 'string' ? req.query.host : ''

  if (isValidShop(shop)) {
    const token = await getOfflineToken(shop)

    if (!token) {
      const authUrl = new URL('/auth', normalizeAppUrl() || `http://localhost:${port}`)
      authUrl.searchParams.set('shop', shop)

      if (host) {
        authUrl.searchParams.set('host', host)
      }

      return res.status(200).send(buildEmbeddedAuthPage(authUrl.toString()))
    }
  }

  return res.type('html').send(renderAppHtml())
})

ensureDatabase()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`RankBoost server running on port ${port}`)
    })
  })
  .catch((error) => {
    console.error('Failed to initialize database connection.', error)
    process.exit(1)
  })
