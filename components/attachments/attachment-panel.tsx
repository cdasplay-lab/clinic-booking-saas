"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { Paperclip, Upload, Trash2, Eye, Download, FileText, Image, File, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AttachmentMeta {
  id: string
  name: string
  mimeType: string
  size: number
  createdAt: string
  uploader?: { name: string | null }
}

interface AttachmentPanelProps {
  entityId: string
  entityType: "INVOICE" | "BILL" | "JOURNAL" | "EXPENSE" | "OTHER"
  readOnly?: boolean
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />
  if (mimeType === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />
  return <File className="h-4 w-4 text-gray-400" />
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AttachmentPanel({ entityId, entityType, readOnly = false }: AttachmentPanelProps) {
  const [files, setFiles] = useState<AttachmentMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchFiles = useCallback(async () => {
    const res = await fetch(`/api/attachments?entityId=${entityId}&entityType=${entityType}`)
    if (res.ok) setFiles(await res.json())
    setLoading(false)
  }, [entityId, entityType])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) { setError("الحجم الأقصى 10 ميغابايت"); return }
    setUploading(true)
    setError("")
    const fd = new FormData()
    fd.append("file", file)
    fd.append("entityId", entityId)
    fd.append("entityType", entityType)

    const res = await fetch("/api/attachments", { method: "POST", body: fd })
    const data = await res.json()
    if (res.ok) {
      setFiles((prev) => [data, ...prev])
    } else {
      setError(data.error || "فشل الرفع")
    }
    setUploading(false)
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    Array.from(fileList).forEach(upload)
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف هذا المرفق؟")) return
    const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" })
    if (res.ok) setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Paperclip className="h-4 w-4" />
        المرفقات
        {files.length > 0 && (
          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
            {files.length}
          </span>
        )}
      </div>

      {/* Upload zone */}
      {!readOnly && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,.pdf,.xlsx,.xls,.txt"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">جاري الرفع...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <Upload className="h-4 w-4" />
              <span className="text-xs">اسحب ملف هنا أو اضغط للاختيار</span>
            </div>
          )}
          <p className="text-xs text-gray-300 mt-1">صور، PDF، Excel — حتى 10 MB</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          <X className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* File list */}
      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      ) : files.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">لا توجد مرفقات</p>
      ) : (
        <div className="space-y-1.5">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 group"
            >
              <FileIcon mimeType={f.mimeType} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-xs text-gray-400">
                  {formatSize(f.size)}
                  {f.uploader?.name && ` · ${f.uploader.name}`}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {f.mimeType.startsWith("image/") || f.mimeType === "application/pdf" ? (
                  <a
                    href={`/api/attachments/${f.id}?inline=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="عرض"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                <a
                  href={`/api/attachments/${f.id}`}
                  download={f.name}
                  className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                  title="تحميل"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(f.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
