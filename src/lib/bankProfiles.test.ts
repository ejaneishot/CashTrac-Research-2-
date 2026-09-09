import { describe, it, expect } from "vitest"
import { detectBank } from "./bankProfiles"

describe("detectBank", () => {
  it("recognises a blu export", () => {
    const matrix: string[][] = [
      ["Rekening / Account", ":", "bluAccount - 006799469949"],
      ["Nama / Name", ":", "Shalfin Khan"],
      ["Mata Uang / Currency", ":", "IDR (Rp)"],
      ["", "", ""],
      ["Tanggal / Date", "Keterangan / Remarks", "Nominal / Amount"],
    ]
    const p = detectBank(matrix)
    expect(p.id).toBe("blu")
    expect(p.swapDateParts).toBe(true)
  })

  it("recognises a BCA statement", () => {
    const matrix: string[][] = [
      ["REKENING GIRO"],
      ["KCP WTC MANGGA DUA"],
      ["FASTRAC GARDA INDONESIA PT"],
      ["NO. REKENING", ":", "8793361929"],
      ["TANGGAL", "KETERANGAN", "CBG", "MUTASI", "SALDO"],
    ]
    const p = detectBank(matrix)
    expect(p.id).toBe("bca")
    expect(p.swapDateParts).toBe(false)
  })

  it("recognises a Jenius statement", () => {
    const matrix: string[][] = [
      ["jenius", "E-STATEMENT July 2026"],
      ["Account holder", "NIRMAL KUMAR KARMANI"],
      ["Account number", "90250211962"],
      ["Cashtag", "nirmalkarmani"],
    ]
    expect(detectBank(matrix).id).toBe("jenius")
  })

  it("falls back to unknown when nothing matches", () => {
    const matrix: string[][] = [
      ["Date", "Description", "Amount"],
      ["01/09/2026", "Something", "500000"],
    ]
    const p = detectBank(matrix)
    expect(p.id).toBe("unknown")
    expect(p.swapDateParts).toBe(false)
  })

  it("does not mistake a plain CSV for blu", () => {
    const matrix: string[][] = [
      ["Tanggal", "Keterangan", "Mutasi", "Saldo"],
      ["01/09/2026", "TRSF E-BANKING CR", "500.000", "1.500.000"],
    ]
    expect(detectBank(matrix).swapDateParts).toBe(false)
  })
})
