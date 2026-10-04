/**
 * Save a blob to the user's downloads under the given file name.
 * @param blob file content
 * @param filename suggested file name
 */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoke after the click has been dispatched, or some browsers cancel it.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Read a picked file as a JSON object.
 * @param file the picked file
 * @returns the parsed object
 * @throws Error naming the file when it is not a JSON object
 */
export async function readJsonObject(file: File): Promise<Record<string, unknown>> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error(`${file.name} is not valid JSON.`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${file.name} is not a JSON object.`)
  }
  return parsed as Record<string, unknown>
}
