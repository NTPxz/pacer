// PromptPay QR payload (EMVCo merchant-presented, Thai QR Payment standard)

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`

/** CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF */
function crc16(s: string): string {
  let crc = 0xffff
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    crc &= 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export const normalizeId = (id: string) => id.replace(/\D/g, '')

export function isValidPromptPay(id: string) {
  const d = normalizeId(id)
  return d.length === 10 || d.length === 13 || d.length === 15
}

export function promptPayPayload(id: string, amount?: number): string {
  const d = normalizeId(id)
  // phone 0812345678 → 0066812345678; 13 digits = national/tax id; 15 = e-wallet
  const target =
    d.length === 10 ? field('01', `0066${d.slice(1)}`) : d.length === 13 ? field('02', d) : field('03', d)
  const hasAmount = amount != null && amount > 0
  const body =
    field('00', '01') +
    field('01', hasAmount ? '12' : '11') +
    field('29', field('00', 'A000000677010111') + target) +
    field('58', 'TH') +
    field('53', '764') +
    (hasAmount ? field('54', amount!.toFixed(2)) : '') +
    '6304'
  return body + crc16(body)
}

export const __test = { crc16 }
