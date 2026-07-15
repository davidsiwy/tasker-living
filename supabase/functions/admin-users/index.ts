// Account management for platform operators. Runs with the service role key,
// every call first verifies the caller is listed in platform_admins.
// Actions: list, create, set_password, update_email, ban, delete.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    // identify the caller from their JWT
    const authHeader = req.headers.get('Authorization') || ''
    const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await caller.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Nepřihlášený požadavek' }, 401)

    // service role client for admin work
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // the caller must be a platform admin
    const { data: pa } = await admin.from('platform_admins').select('user_id').eq('user_id', userData.user.id).maybeSingle()
    if (!pa) return json({ error: 'Pouze pro operátory platformy' }, 403)

    const body = await req.json().catch(() => ({}))
    const action = body.action as string

    if (action === 'list') {
      const users: unknown[] = []
      let page = 1
      for (;;) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
        if (error) return json({ error: error.message }, 400)
        for (const u of data.users) {
          users.push({
            id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
            banned: Boolean((u as { banned_until?: string }).banned_until && new Date((u as { banned_until?: string }).banned_until!) > new Date()),
          })
        }
        if (data.users.length < 200) break
        page++
      }
      return json({ users })
    }

    if (action === 'create') {
      const { email, password, full_name, building_id, role, unit_id } = body
      if (!email || !password) return json({ error: 'Chybí e-mail nebo heslo' }, 400)
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: full_name || 'Rezident' },
      })
      if (error) return json({ error: error.message }, 400)
      if (building_id && role) {
        const { error: mErr } = await admin.from('memberships').insert({
          user_id: data.user.id, building_id, role, unit_id: unit_id || null,
        })
        if (mErr) return json({ error: 'Účet vytvořen, ale členství selhalo: ' + mErr.message }, 400)
      }
      return json({ ok: true, user_id: data.user.id })
    }

    if (action === 'set_password') {
      const { user_id, password } = body
      if (!user_id || !password) return json({ error: 'Chybí uživatel nebo heslo' }, 400)
      const { error } = await admin.auth.admin.updateUserById(user_id, { password })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    if (action === 'update_email') {
      const { user_id, email } = body
      if (!user_id || !email) return json({ error: 'Chybí uživatel nebo e-mail' }, 400)
      const { error } = await admin.auth.admin.updateUserById(user_id, { email, email_confirm: true })
      if (error) return json({ error: error.message }, 400)
      await admin.from('profiles').update({ email }).eq('id', user_id)
      return json({ ok: true })
    }

    if (action === 'ban') {
      const { user_id, banned } = body
      if (!user_id) return json({ error: 'Chybí uživatel' }, 400)
      const { error } = await admin.auth.admin.updateUserById(user_id, { ban_duration: banned ? '87600h' : 'none' })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    if (action === 'delete') {
      const { user_id } = body
      if (!user_id) return json({ error: 'Chybí uživatel' }, 400)
      if (user_id === userData.user.id) return json({ error: 'Nemůžete smazat vlastní účet' }, 400)
      const { error } = await admin.auth.admin.deleteUser(user_id)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    return json({ error: 'Neznámá akce' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message || 'Chyba serveru' }, 500)
  }
})
