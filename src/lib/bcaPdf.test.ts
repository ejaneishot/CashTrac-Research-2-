import { describe, it, expect } from "vitest"
import { parseBcaStatement } from "./bcaPdf"
import type { TextPiece } from "./pdfText"

function p(y: number, x: number, text: string, page = 1): TextPiece {
  return { y, x, text, page }
}

/** A small statement with the same shape as a real one. */
const pieces: TextPiece[] = [
  p(87, 324, "NO. REKENING"),
  p(87, 435, "8793361929"),
  p(119, 324, "PERIODE"),
  p(119, 435, "JULI 2026"),
  p(377, 44, "TANGGAL"),
  p(377, 194, "KETERANGAN"),
  p(400, 44, "01/07"),
  p(400, 89, "SALDO AWAL"),
  p(400, 523, "5,747,393.00"),
  p(424, 44, "01/07"),
  p(424, 89, "BI-FAST CR"),
  p(424, 194, "BIF TRANSFER DR"),
  p(424, 387, "20,000,000.00"),
  p(424, 523, "25,747,393.00"),
  p(436, 194, "NIRMAL KUMAR KARMA"),
  p(489, 44, "01/07"),
  p(489, 89, "TRSF E-BANKING DB"),
  p(489, 194, "0107/FTSCY/WS95051"),
  p(489, 391, "5,500,000.00"),
  p(489, 442, "DB"),
  p(501, 194, "5500000.00"),
  p(513, 194, "FERNANDO NATHANAEL"),
  p(702, 209, "SALDO AWAL"),
  p(702, 265, ":"),
  p(702, 322, "5,747,393.00"),
  p(714, 209, "MUTASI CR"),
  p(714, 265, ":"),
  p(714, 314, "20,000,000.00"),
  p(738, 209, "SALDO AKHIR"),
  p(738, 265, ":"),
  p(738, 321, "20,247,393.00"),
]

describe("parseBcaStatement", () => {
  const parsed = parseBcaStatement(pieces)

  it("reads the account number", () => {
    expect(parsed.accountNumber).toBe("8793361929")
  })

  it("takes the year from the statement period", () => {
    expect(parsed.year).toBe(2026)
  })

  it("reads the opening and closing balances from the summary", () => {
    expect(parsed.openingBalance).toBe(5747393)
    expect(parsed.closingBalance).toBe(20247393)
  })

  it("does not treat the opening balance line as a transaction", () => {
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows.every((r) => !r.description.startsWith("SALDO AWAL"))).toBe(true)
  })

  it("reads a credit as positive", () => {
    expect(parsed.rows[0].amount).toBe(20000000)
  })

  it("reads a DB marker as negative", () => {
    expect(parsed.rows[1].amount).toBe(-5500000)
  })

  it("keeps every description line, so similar rows stay distinct", () => {
    expect(parsed.rows[1].description).toContain("FERNANDO NATHANAEL")
    expect(parsed.rows[1].description).toContain("0107/FTSCY/WS95051")
  })

  it("stops at the summary block instead of absorbing it", () => {
    const last = parsed.rows[parsed.rows.length - 1]
    expect(last.description).not.toContain("SALDO AKHIR")
    expect(last.description).not.toContain("MUTASI CR")
  })
})
