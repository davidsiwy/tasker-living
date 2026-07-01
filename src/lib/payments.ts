// Czech QR platba (SPAYD) helpers. Everything here runs in the browser, no
// backend needed. Generates the standard payment string that Czech banking apps
// scan to prefill account, amount and variabilní symbol.

export function parseAccount(s: string) {
  const [left, bank = ''] = (s || '').split('/')
  let prefix = '', account = (left || '').trim()
  if (account.includes('-')) { const [p, a] = account.split('-'); prefix = p; account = a }
  return { prefix: prefix.trim(), account: account.trim(), bank: bank.trim() }
}

// Build a Czech IBAN from a domestic account number (prefix, number, bank code).
export function czIban(prefix: string, account: string, bank: string): string {
  const p = (prefix || '').replace(/\D/g, '').padStart(6, '0')
  const a = (account || '').replace(/\D/g, '').padStart(10, '0')
  const b = (bank || '').replace(/\D/g, '').padStart(4, '0')
  const bban = b + p + a
  const check = String(98 - mod97(bban + '1235' + '00')).padStart(2, '0') // C=12, Z=35
  return 'CZ' + check + bban
}
function mod97(num: string): number { let r = 0; for (const ch of num) r = (r * 10 + (ch.charCodeAt(0) - 48)) % 97; return r }

export function formatIban(iban: string): string { return iban.replace(/(.{4})/g, '$1 ').trim() }

function ascii(s: string): string { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '') }

export function spayd(o: { iban: string; amount: number; vs?: string; msg?: string; recipient?: string }): string {
  const parts = ['SPD', '1.0', 'ACC:' + o.iban, 'AM:' + o.amount.toFixed(2), 'CC:CZK']
  if (o.vs) parts.push('X-VS:' + o.vs)
  if (o.recipient) parts.push('RN:' + ascii(o.recipient).toUpperCase().slice(0, 35))
  if (o.msg) parts.push('MSG:' + ascii(o.msg).toUpperCase().slice(0, 60))
  return parts.join('*')
}
