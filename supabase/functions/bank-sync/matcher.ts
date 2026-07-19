// Čisté funkce parsování a párování — sdílené s testy.
type FioTx = Record<string, { value: unknown } | null>
const val = (t: FioTx, k: string): unknown => (t[k] && typeof t[k] === 'object' ? (t[k] as { value: unknown }).value : undefined)

export function parseFioTransactions(payload: unknown): {
  txId: string; date: string | null; amount: number; vs: string; counter: string; message: string; raw: unknown
}[] {
  const list = (payload as any)?.accountStatement?.transactionList?.transaction
  if (!Array.isArray(list)) return []
  return list.map((t: FioTx) => {
    const amount = Number(val(t, 'column1') ?? 0)
    const rawDate = String(val(t, 'column0') ?? '')
    return {
      txId: String(val(t, 'column22') ?? ''),
      date: rawDate ? rawDate.slice(0, 10) : null,
      amount,
      vs: String(val(t, 'column5') ?? '').trim(),
      counter: [val(t, 'column2'), val(t, 'column3')].filter(Boolean).join('/'),
      message: String(val(t, 'column16') ?? val(t, 'column25') ?? val(t, 'column7') ?? '').slice(0, 300),
      raw: t,
    }
  }).filter((t) => t.txId)
}

export function matchPlan(
  incoming: { txId: string; amount: number; vs: string }[],
  openCharges: { id: string; vs: string | null; amount: number }[],
): Record<string, { status: 'matched' | 'review' | 'unmatched'; chargeId?: string }> {
  const out: Record<string, { status: 'matched' | 'review' | 'unmatched'; chargeId?: string }> = {}
  const taken = new Set<string>()
  for (const tx of incoming) {
    if (!tx.vs) { out[tx.txId] = { status: 'unmatched' }; continue }
    const byVs = openCharges.filter((c) => (c.vs || '').trim() === tx.vs && !taken.has(c.id))
    if (byVs.length === 0) { out[tx.txId] = { status: 'unmatched' }; continue }
    const exact = byVs.filter((c) => Number(c.amount) === Number(tx.amount))
    if (exact.length === 1) { taken.add(exact[0].id); out[tx.txId] = { status: 'matched', chargeId: exact[0].id }; continue }
    out[tx.txId] = { status: 'review' }
  }
  return out
}
