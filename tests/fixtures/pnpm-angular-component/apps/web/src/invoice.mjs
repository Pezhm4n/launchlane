/** @param {ReadonlyArray<{price: number; quantity: number}>} lines */
export function invoiceTotal(lines) { return lines.reduce((sum, line) => sum + line.price * line.quantity, 0); }
