// POST /api/delete-account — permanently deletes the signed-in user, their synced documents
// (user_docs rows cascade with auth.users) and their photos in Storage.
// Needs the service-role key, which must never reach the browser — hence a server function.

import { createClient } from '@supabase/supabase-js'

const BUCKET = 'race-photos'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export async function POST(request: Request) {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return json({ error: 'server not configured' }, 500)

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'missing token' }, 401)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return json({ error: 'invalid token' }, 401)
  const uid = data.user.id

  // storage objects don't cascade with the user, so remove them first (paged)
  for (;;) {
    const { data: files, error: listErr } = await admin.storage.from(BUCKET).list(uid, { limit: 1000 })
    if (listErr) return json({ error: 'could not list photos' }, 500)
    if (!files?.length) break
    const { error: rmErr } = await admin.storage.from(BUCKET).remove(files.map((f) => `${uid}/${f.name}`))
    if (rmErr) return json({ error: 'could not delete photos' }, 500)
    if (files.length < 1000) break
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(uid)
  if (delErr) return json({ error: 'could not delete account' }, 500)
  return json({ ok: true })
}
