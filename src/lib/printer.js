// ESC/POS printer integration via Web Serial API
// Falls back gracefully if no hardware connected

let serialPort = null
let writer = null

const ESC = 0x1b
const GS = 0x1d

function encode(text) {
  return new TextEncoder().encode(text)
}

function escpos(bytes) {
  return new Uint8Array(bytes)
}

async function write(data) {
  if (!writer) return false
  try {
    await writer.write(data)
    return true
  } catch {
    return false
  }
}

export function isPrinterConnected() {
  return writer !== null
}

export async function connectPrinter() {
  if (!('serial' in navigator)) return { ok: false, error: 'Web Serial not supported' }
  try {
    const port = await navigator.serial.requestPort()
    await port.open({ baudRate: 9600 })
    serialPort = port
    writer = port.writable.getWriter()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

export async function disconnectPrinter() {
  try {
    writer?.releaseLock()
    await serialPort?.close()
  } catch { /* ignore */ }
  writer = null
  serialPort = null
}

// Opens cash drawer (connected to printer)
export async function openCashDrawer() {
  // ESC/POS cash drawer kick: ESC p 0 25 250
  return write(escpos([ESC, 0x70, 0x00, 0x19, 0xfa]))
}

export async function printTicket({ type, tableNumber, items, allergens, staffName, note, time }) {
  if (!writer) return false

  const lines = []
  lines.push(escpos([ESC, 0x40])) // init
  lines.push(escpos([ESC, 0x61, 0x01])) // center
  lines.push(encode(`=== ${type === 'kitchen' ? 'KITCHEN' : 'BAR'} TICKET ===\n`))
  lines.push(encode(`Table: ${tableNumber}\n`))
  lines.push(encode(`Staff: ${staffName}\n`))
  lines.push(encode(`Time: ${time}\n`))
  lines.push(encode('--------------------------------\n'))
  lines.push(escpos([ESC, 0x61, 0x00])) // left
  for (const item of items) {
    lines.push(encode(`${item.quantity}x ${item.name}\n`))
  }
  if (allergens?.length) {
    lines.push(encode(`\n!! ALLERGENS: ${allergens.join(', ')} !!\n`))
  }
  if (note) {
    lines.push(encode(`Note: ${note}\n`))
  }
  lines.push(encode('\n\n\n'))
  lines.push(escpos([GS, 0x56, 0x41, 0x10])) // cut

  for (const chunk of lines) {
    await write(chunk)
  }
  return true
}
