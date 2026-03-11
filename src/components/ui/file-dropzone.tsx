"use client"

import { Paperclip, UploadCloud, X } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FileDropzoneProps = {
  id: string
  label: string
  hint?: string
  files: File[]
  disabled?: boolean
  error?: string
  onFilesAdd: (files: File[]) => void
  onFileRemove: (file: File) => void
}

export function FileDropzone({
  id,
  label,
  hint,
  files,
  disabled,
  error,
  onFilesAdd,
  onFileRemove,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleIncoming(filesList: FileList | null) {
    if (!filesList || filesList.length === 0) {
      return
    }

    onFilesAdd(Array.from(filesList))
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">{label}</p>
      <div
        className={cn(
          "rounded-md border border-dashed p-4 transition",
          isDragging
            ? "border-[#ff8b2b] bg-[#ff8b2b]/5"
            : "border-slate-300/90 bg-white",
          error ? "border-[#d3582a]" : undefined,
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        )}
        onClick={() => {
          if (!disabled) {
            inputRef.current?.click()
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled) {
            setIsDragging(true)
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setIsDragging(false)
        }}
        onDragOver={(event) => {
          event.preventDefault()
        }}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          if (disabled) {
            return
          }

          handleIncoming(event.dataTransfer.files)
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
      >
        <input
          id={id}
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            handleIncoming(event.target.files)
            event.currentTarget.value = ""
          }}
          ref={inputRef}
          type="file"
        />
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-600">
            <UploadCloud className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">Drop files here or click to upload</p>
            {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
          </div>
        </div>
      </div>

      {files.length > 0 ? (
        <ul className="space-y-1">
          {files.map((file) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs"
            >
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <Paperclip className="size-3.5" />
                {file.name}
              </span>
              <Button
                className="h-6 rounded-sm px-2 text-[10px]"
                disabled={disabled}
                onClick={() => {
                  onFileRemove(file)
                }}
                type="button"
                variant="ghost"
              >
                <X className="mr-1 size-3.5" />
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="text-xs text-[#d3582a]">{error}</p> : null}
    </div>
  )
}
