import { forwardRef, useEffect, useRef } from "react"
import ReactQuill from "react-quill"
import "react-quill/dist/quill.snow.css"
import { cn } from "@/lib/utils"

interface RichTextEditorProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  readOnly?: boolean
  theme?: "snow" | "bubble"
  modules?: any
  formats?: string[]
  height?: string
}

const RichTextEditor = forwardRef<ReactQuill, RichTextEditorProps>(
  ({
    value,
    onChange,
    placeholder,
    className,
    readOnly = false,
    theme = "snow",
    height = "120px",
    modules: customModules,
    formats: customFormats,
    ...props
  }, ref) => {
    const quillRef = useRef<ReactQuill>(null)

    const defaultModules = {
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link'],
        ['clean']
      ],
    }

    const defaultFormats = [
      'header',
      'bold', 'italic', 'underline', 'strike',
      'blockquote', 'code-block',
      'list', 'bullet',
      'script',
      'color', 'background',
      'align',
      'link'
    ]

    const modules = customModules || defaultModules
    const formats = customFormats || defaultFormats

    useEffect(() => {
      if (ref && typeof ref === 'function') {
        ref(quillRef.current)
      } else if (ref && quillRef.current) {
        ref.current = quillRef.current
      }
    }, [ref])

    return (
      <div className={cn("rich-text-editor", className)}>
        <style jsx>{`
          .rich-text-editor .ql-editor {
            min-height: ${height};
            font-size: 14px;
            line-height: 1.5;
          }

          .rich-text-editor .ql-toolbar {
            border-top: 1px solid hsl(var(--border));
            border-left: 1px solid hsl(var(--border));
            border-right: 1px solid hsl(var(--border));
            border-bottom: none;
            border-top-left-radius: 6px;
            border-top-right-radius: 6px;
            background: hsl(var(--background));
          }

          .rich-text-editor .ql-container {
            border-bottom: 1px solid hsl(var(--border));
            border-left: 1px solid hsl(var(--border));
            border-right: 1px solid hsl(var(--border));
            border-top: none;
            border-bottom-left-radius: 6px;
            border-bottom-right-radius: 6px;
            background: hsl(var(--background));
          }

          .rich-text-editor .ql-editor.ql-blank::before {
            color: hsl(var(--muted-foreground));
            font-style: normal;
          }

          .rich-text-editor .ql-snow.ql-toolbar button:hover,
          .rich-text-editor .ql-snow .ql-toolbar button:hover,
          .rich-text-editor .ql-snow.ql-toolbar button:focus,
          .rich-text-editor .ql-snow .ql-toolbar button:focus {
            color: hsl(var(--primary));
          }

          .rich-text-editor .ql-snow.ql-toolbar button.ql-active,
          .rich-text-editor .ql-snow .ql-toolbar button.ql-active {
            color: hsl(var(--primary));
          }

          .rich-text-editor .ql-snow .ql-stroke {
            stroke: hsl(var(--muted-foreground));
          }

          .rich-text-editor .ql-snow .ql-fill {
            fill: hsl(var(--muted-foreground));
          }

          .rich-text-editor .ql-snow.ql-toolbar button:hover .ql-stroke,
          .rich-text-editor .ql-snow .ql-toolbar button:hover .ql-stroke,
          .rich-text-editor .ql-snow.ql-toolbar button:focus .ql-stroke,
          .rich-text-editor .ql-snow .ql-toolbar button:focus .ql-stroke,
          .rich-text-editor .ql-snow.ql-toolbar button.ql-active .ql-stroke,
          .rich-text-editor .ql-snow .ql-toolbar button.ql-active .ql-stroke {
            stroke: hsl(var(--primary));
          }

          .rich-text-editor .ql-snow.ql-toolbar button:hover .ql-fill,
          .rich-text-editor .ql-snow .ql-toolbar button:hover .ql-fill,
          .rich-text-editor .ql-snow.ql-toolbar button:focus .ql-fill,
          .rich-text-editor .ql-snow .ql-toolbar button:focus .ql-fill,
          .rich-text-editor .ql-snow.ql-toolbar button.ql-active .ql-fill,
          .rich-text-editor .ql-snow .ql-toolbar button.ql-active .ql-fill {
            fill: hsl(var(--primary));
          }

          .rich-text-editor .ql-editor {
            color: hsl(var(--foreground));
          }

          .rich-text-editor .ql-editor p,
          .rich-text-editor .ql-editor ol,
          .rich-text-editor .ql-editor ul,
          .rich-text-editor .ql-editor blockquote {
            margin: 0 0 8px 0;
          }

          .rich-text-editor .ql-editor h1,
          .rich-text-editor .ql-editor h2,
          .rich-text-editor .ql-editor h3 {
            margin: 0 0 12px 0;
          }
        `}</style>

        <ReactQuill
          ref={quillRef}
          theme={theme}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          placeholder={placeholder}
          modules={modules}
          formats={formats}
          {...props}
        />
      </div>
    )
  }
)

RichTextEditor.displayName = "RichTextEditor"

export { RichTextEditor }