import { useCallback, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, UploadSimple, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { useStore } from '../../store'
import { formatIDR } from '../../lib/money'
import type { ImportReport } from '../../lib/importer'

/**
 * Statement import.
 * Reads the file and shows what it found before anything is saved.
 * Nothing reaches the ledger until the person presses Import.
 */
export function StatementDropzone({ accountId, onClose }: { accountId?: string; onClose: () => void }) {
  const { data, prepareImport, commitImport, recordPdfStatement, pushToast } = useStore()
  const [target, setTarget] = useState(accountId ?? data.accounts[0]?.id ?? '')
  const [report, setReport] = useState<ImportReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [pdfLink, setPdfLink] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const account = useMemo(() => data.accounts.find((a) => a.id === target), [data.accounts, target])

  const handleFile = useCallback(async (file: File) => {
    setError(null)
        const name = file.name.toLowerCase()
    if (!target) {
      setError('Pick an account first.')
      return
    }


        if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.pdf')) {
      setError('That file type cannot be read. Use a CSV, Excel or PDF statement.')
      return
    }
    if (!target) {
      setError('Pick an account first.')
      return
    }
    setBusy(true)
       try {
      setReport(await prepareImport(file, target))
    } catch (e) {
      if (name.endsWith('.pdf')) {
        try {
          setPdfLink(await recordPdfStatement(file, target))
          setBusy(false)
          return
        } catch (inner) {
          setError((inner as Error).message)
          setBusy(false)
          return
        }
      }
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
    }, [prepareImport, recordPdfStatement, target])

  const confirm = async () => {
    if (!report) return
    setBusy(true)
    try {
      await commitImport(report)
      onClose()
    } catch (e) {
      pushToast('error', (e as Error).message)
      setBusy(false)
    }
  }

  const tally = report?.tally

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-line bg-surface-raised p-6"
      >
        <div className="flex items-start justify-between">
          <div>
  \          <h2 className="text-xl font-semibold tracking-tight">Import statement</h2>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              {account ? account.name : 'No account selected'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-ink-muted transition-colors hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {!report && !pdfLink && (
          <>
            <label className="mt-5 block text-[12px] font-medium uppercase tracking-[0.14em] text-ink-muted">
              Account
            </label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-line bg-surface px-3 py-2.5 text-[13.5px]"
            >
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                const f = e.dataTransfer.files[0]
                if (f) void handleFile(f)
              }}
              className={`mt-4 cursor-pointer rounded-[1.5rem] border border-dashed px-5 py-10 text-center transition-colors ${
                dragging ? 'border-accent bg-surface-hover' : 'border-line hover:border-ink-faint'
              }`}
            >
              <UploadSimple size={22} className="mx-auto text-ink-faint" />
              <p className="mt-3 text-[13.5px] font-medium">
                {busy ? 'Reading the file…' : 'Drop a CSV or Excel file here, or click to pick one'}
              </p>
              <p className="mt-1 text-[11.5px] text-ink-faint">Nothing is saved until you review it</p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFile(f)
                e.target.value = ''
              }}
            />
          </>
        )}

     {pdfLink && (
          <div className="mt-5 space-y-4">
            <div className="rounded-[1.5rem] border border-line bg-surface p-4">
              <p className="text-[13px] font-medium">Saved to Drive</p>
              <p className="mt-1 text-[12.5px] text-ink-muted">
                PDF statements cannot be read automatically. The file is stored with the account and a marker row is in the ledger, so it will not be forgotten. The transactions still need entering by hand.
              </p>
              <a href={pdfLink} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[12.5px] text-accent hover:underline">
                Open the statement in Drive
              </a>
            </div>
            <button onClick={onClose} className="w-full rounded-2xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-surface transition-all hover:bg-ink/90 active:scale-[0.98]">
              Done
            </button>
          </div>
        )}
        {error && (
          <p className="mt-4 rounded-2xl border border-neg/20 bg-neg-soft px-4 py-3 text-[12.5px] text-neg">
            {error}
          </p>
        )}

        {report && (
          <div className="mt-5 space-y-4">
            <div className="rounded-[1.5rem] border border-line bg-surface p-4">
              <p className="text-[13px] font-medium">{report.filename}</p>
              <p className="tnum mt-1 text-[12.5px] text-ink-muted">
                {report.rowsFound} rows read · {report.rowsNew} new · {report.rowsDuplicate} already in the ledger
              </p>
              {report.errors.length > 0 && (
                <p className="tnum mt-1 text-[12.5px] text-neg">
                  {report.errors.length} rows could not be read: {report.errors[0].reason}
                </p>
              )}
            </div>

            <div className="rounded-[1.5rem] border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-muted">Tally</p>
                {tally?.available ? (
                  <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    tally.tallied
                      ? 'border-pos/20 bg-pos-soft text-pos'
                      : 'border-neg/20 bg-neg-soft text-neg'
                  }`}>
                    {tally.tallied ? <CheckCircle size={11} /> : <WarningCircle size={11} />}
                    {tally.tallied ? 'Tallied' : 'Mismatch'}
                  </span>
                ) : (
                  <span className="text-[11px] text-ink-faint">{tally?.reason}</span>
                )}
              </div>

              <div className="mt-3 space-y-1.5 text-[12.5px]">
                {tally?.available && (
                  <Line label="Saldo awal" value={formatIDR(tally.saldoAwal ?? 0)} />
                )}
                <Line label="Inflows" value={formatIDR(tally?.inflows ?? 0)} tone="pos" />
                <Line label="Outflows" value={formatIDR(-(tally?.outflows ?? 0))} tone="neg" />
                {tally?.available && (
                  <>
                    <Line label="Expected" value={formatIDR(tally.expected ?? 0)} strong />
                    <Line label="Saldo akhir" value={formatIDR(tally.saldoAkhir ?? 0)} strong />
                    {!tally.tallied && (
                      <Line label="Off by" value={formatIDR(tally.difference ?? 0)} tone="neg" strong />
                    )}
                  </>
                )}
              </div>
            </div>

            {report.continuityGap !== undefined && (
              <p className="rounded-2xl border border-neg/20 bg-neg-soft px-4 py-3 text-[12.5px] text-neg">
                This statement opens {formatIDR(Math.abs(report.continuityGap))} away from where the ledger
                left off. A statement may be missing between the two.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setReport(null); setError(null) }}
                className="flex-1 rounded-2xl border border-line px-4 py-2.5 text-[13.5px] font-semibold transition-all hover:bg-surface-hover active:scale-[0.98]"
              >
                Choose another file
              </button>
              <button
                onClick={() => void confirm()}
                disabled={busy || report.rowsNew === 0}
                className="flex-1 rounded-2xl bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-surface transition-all hover:bg-ink/90 active:scale-[0.98] disabled:opacity-40"
              >
                {report.rowsNew === 0 ? 'Nothing new' : `Import ${report.rowsNew} rows`}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function Line({ label, value, tone, strong }: {
  label: string
  value: string
  tone?: 'pos' | 'neg'
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={`tnum ${strong ? 'font-semibold' : ''} ${
        tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : 'text-ink'
      }`}>
        {value}
      </span>
    </div>
  )
}