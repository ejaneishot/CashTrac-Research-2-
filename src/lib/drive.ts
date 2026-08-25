/**
 * Drive API wrappers — workspace discovery, folder resolution, raw-file upload.
 */

const DRIVE_FOLDER = 'application/vnd.google-apps.folder'

function drive() {
  const d = window.gapi?.client.drive
  if (!d) throw new Error('Drive API not loaded')
  return d
}

/** Extract a folder/file id from a Drive share link. */
export function idFromLink(link: string): string | null {
  const m = link.match(/\/d\/([a-zA-Z0-9_-]+)/) ?? link.match(/folders\/([a-zA-Z0-9_-]+)/)
  return m?.[1] ?? null
}

export async function resolveFile(id: string): Promise<{ id: string; name: string } | null> {
  try {
    const res = await drive().files.get({ fileId: id, fields: 'id,name' })
    return res.result
  } catch {
    return null
  }
}

/** Find folders named like a workspace under a parent (or root). */
export async function listFolders(parentId?: string): Promise<{ id: string; name: string }[]> {
  const q = [
    `mimeType='${DRIVE_FOLDER}'`,
    parentId ? `and '${parentId}' in parents` : `and 'root' in parents`,
    `and trashed=false`,
  ].join(' ')
  const res = await drive().files.list({
    q,
    fields: 'files(id,name)',
    pageSize: 100,
  })
  return res.result.files ?? []
}

/** Upload a raw statement file into a Drive folder. Returns the file id. */
export async function uploadFile(
  parentId: string,
  name: string,
  blob: Blob,
): Promise<{ id: string; webLink: string }> {
  const meta = { name, parents: [parentId] }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
  form.append('file', blob)

  const token = window.gapi?.client.getToken?.() as { access_token?: string } | null
  if (!token?.access_token) throw new Error('Not authenticated')

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.access_token}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  const data = (await res.json()) as { id: string; webViewLink: string }
  return { id: data.id, webLink: data.webViewLink }
}

export function driveFolderLink(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`
}

export function driveFileLink(fileId: string): string {
  return `https://drive.google.com/open?id=${fileId}`
}

/** Create a folder inside a parent. Returns its id. */
export async function createFolder(parentId: string, name: string): Promise<string> {
  const res = await drive().files.create({
    fields: 'id',
    requestBody: { name, mimeType: DRIVE_FOLDER, parents: [parentId] },
  })
  return res.result.id
}
