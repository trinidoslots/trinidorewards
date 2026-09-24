import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import JSZip from "jszip"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"

const EXTENSION_DIR = path.join(process.cwd(), "extension")

export async function GET() {
  // The extension is the admin's tool; only an admin downloads it.
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const zip = new JSZip()
  const files = await readdir(EXTENSION_DIR)

  await Promise.all(
    files.map(async (fileName) => {
      const filePath = path.join(EXTENSION_DIR, fileName)
      const contents = await readFile(filePath)
      zip.file(fileName, contents)
    }),
  )

  const buffer = await zip.generateAsync({ type: "nodebuffer" })

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="bonushunt-tracker-extension.zip"',
    },
  })
}
