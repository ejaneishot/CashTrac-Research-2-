import { describe, it, expect } from "vitest"
import { detectBank, readStatementDate, UNKNOWN_PROFILE } from "./bankProfiles"

const blu = detectBank([["Rekening / Account", ":", "bluAccount - 006799469949"]])

function ymd(d: Date | null): string {
  if (!d) return "null"
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return d.getFullYear() + "-" + m + "-" + day
}

describe("readStatementDate", () => {
  it("corrects blu dates that Excel misread", () => {
    // These are the real values from the 01-18 August 2026 export.
    expect(ymd(readStatementDate(new Date(2026, 0, 8), blu))).toBe("2026-08-01")
    expect(ymd(readStatementDate(new Date(2026, 1, 8), blu))).toBe("2026-08-02")
    expect(ymd(readStatementDate(new Date(2026, 4, 8), blu))).toBe("2026-08-05")
    expect(ymd(readStatementDate(new Date(2026, 5, 8), blu))).toBe("2026-08-06")
  })

  it("leaves 8 August alone, since it reads the same either way", () => {
    expect(ymd(readStatementDate(new Date(2026, 7, 8), blu))).toBe("2026-08-08")
  })

  it("reads blu text dates as day/month/year without swapping", () => {
    expect(ymd(readStatementDate("14/08/2026", blu))).toBe("2026-08-14")
    expect(ymd(readStatementDate("18/08/2026", blu))).toBe("2026-08-18")
  })

  it("does not touch dates from other banks", () => {
    const d = new Date(2026, 0, 8)
    expect(ymd(readStatementDate(d, UNKNOWN_PROFILE))).toBe("2026-01-08")
  })

  it("reads plain text dates for any bank", () => {
    expect(ymd(readStatementDate("01/09/2026", UNKNOWN_PROFILE))).toBe("2026-09-01")
  })

  it("returns null for values it cannot read", () => {
    expect(readStatementDate("not a date", blu)).toBeNull()
    expect(readStatementDate(null, blu)).toBeNull()
    expect(readStatementDate(42, blu)).toBeNull()
  })
})
