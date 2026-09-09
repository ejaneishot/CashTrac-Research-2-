
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { parseBcaStatement } from './bcaPdf'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface TextPiece {
  text: string
  /** Distance from the left edge, in PDF points. */
  x: number
  /** Distance from the top of the page, in PDF points. Larger means further down. */
  y: number
  page: number
}

export async function readPdfPieces(file: File): Promise<TextPiece[]> {
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pieces: TextPiece[] = []

  for (let page = 1; page <= doc.numPages; page++) {
    const p = await doc.getPage(page)
    const content = await p.getTextContent()
    const height = p.getViewport({ scale: 1 }).height

    for (const item of content.items) {
      if (!('str' in item)) continue
      const text = item.str.trim()
      if (!text) continue
      // transform holds the position; index 4 is x, index 5 is y measured
      // from the bottom, so flip it to measure from the top instead.
      pieces.push({
        text,
        x: Math.round(item.transform[4]),
        y: Math.round(height - item.transform[5]),
        page,
      })
    }
  }

  return pieces
}

//temp btw
export async function dumpPdfLayout(file: File): Promise<void> {
  const pieces = await readPdfPieces(file)
  console.log('total pieces', pieces.length, 'pages', Math.max(...pieces.map((p) => p.page)))
    const parsed = parseBcaStatement(pieces)
  console.log('account', parsed.accountNumber, 'year', parsed.year)
  console.log('opening', parsed.openingBalance, 'closing', parsed.closingBalance)
  console.log('rows', parsed.rows.length)
  const total = parsed.rows.reduce((s, r) => s + r.amount, 0)
  console.log('sum of rows', total)
   if (parsed.openingBalance !== null && parsed.closingBalance !== null) {
    console.log('expected closing', parsed.openingBalance + total, 'actual', parsed.closingBalance)
  }
  const last = pieces.filter((p) => p.page === 2 && p.y > 600 && p.y < 705)
  console.table(last.map((p) => ({ y: p.y, x: p.x, text: p.text })))
}
