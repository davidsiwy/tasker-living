// Handoff to the Tasker platform for service ordering and payment. When
// VITE_TASKER_API_URL is set the calls hit the real Tasker API, otherwise they
// return a demo order so the flow is visible.
const BASE = import.meta.env.VITE_TASKER_API_URL as string | undefined
export const taskerConfigured = Boolean(BASE)

export const taskerApi = {
  async createOrder(input: { service: string; unit: string; when?: string; note?: string }): Promise<{ orderId: string; payUrl?: string }> {
    if (!BASE) { await new Promise((r) => setTimeout(r, 500)); return { orderId: 'TSK-' + Math.random().toString(36).slice(2, 8).toUpperCase() } }
    const res = await fetch(BASE.replace(/\/$/, '') + '/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    if (!res.ok) throw new Error('Tasker API: ' + res.status)
    return res.json()
  },
}
