import { forwardRef, useEffect, useRef, useMemo, useCallback } from "react"
import ReactQuill, { Quill } from "react-quill"
import "react-quill/dist/quill.snow.css"
import { cn } from "@/lib/utils"

// Register video blot for Quill - only register if not already registered
const BlockEmbed = Quill.import('blots/block/embed')

class VideoBlot extends BlockEmbed {
  static blotName = 'video'
  static tagName = 'iframe'

  static create(value: string) {
    const node = super.create()
    node.setAttribute('src', value)
    node.setAttribute('frameborder', '0')
    node.setAttribute('allowfullscreen', true)
    node.setAttribute('width', '100%')
    node.setAttribute('height', '315')
    node.style.maxWidth = '100%'
    return node
  }

  static value(node: HTMLElement) {
    return node.getAttribute('src')
  }
}

// Only register if not already registered to prevent overwriting warnings
try {
  Quill.import('formats/video')
} catch (e) {
  Quill.register(VideoBlot)
}

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
    value = '',
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
    const containerRef = useRef<HTMLDivElement>(null)

    // Convert file to base64 and insert directly
    const imageHandler = useCallback(() => {
      const input = document.createElement('input')
      input.setAttribute('type', 'file')
      input.setAttribute('accept', 'image/*')
      input.click()

      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return

        // Check file size (limit to 5MB)
        const maxSize = 5 * 1024 * 1024 // 5MB in bytes
        if (file.size > maxSize) {
          alert('Image size must be less than 5MB. Please choose a smaller image.')
          return
        }

        // Check file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        if (!allowedTypes.includes(file.type)) {
          alert('Please select a valid image file (JPEG, PNG, GIF, or WebP).')
          return
        }

        try {
          console.log('Converting image to base64:', file.name, 'Size:', file.size)

          // Convert file to base64
          const reader = new FileReader()
          reader.onload = () => {
            const base64String = reader.result as string
            const quillEditor = quillRef.current?.getEditor()
            if (quillEditor && base64String) {
              const range = quillEditor.getSelection(true)
              quillEditor.insertEmbed(range?.index || 0, 'image', base64String)
              quillEditor.setSelection((range?.index || 0) + 1, 0)
              console.log('Base64 image inserted successfully')
            }
          }

          reader.onerror = () => {
            console.error('Error reading file')
            alert('Failed to read image file. Please try again.')
          }

          reader.readAsDataURL(file)
        } catch (error: any) {
          console.error('Error converting image to base64:', error)
          alert('Failed to process image: ' + error.message)
        }
      }
    }, [])

    // Video handler using useCallback
    const videoHandler = useCallback(() => {
      const url = prompt('Enter video URL (YouTube, Vimeo, etc.):')
      if (url) {
        let embedUrl = url

        // Convert YouTube URLs to embed format
        if (url.includes('youtube.com/watch')) {
          const videoId = url.split('v=')[1]?.split('&')[0]
          if (videoId) {
            embedUrl = `https://www.youtube.com/embed/${videoId}`
          }
        } else if (url.includes('youtu.be/')) {
          const videoId = url.split('youtu.be/')[1]?.split('?')[0]
          if (videoId) {
            embedUrl = `https://www.youtube.com/embed/${videoId}`
          }
        } else if (url.includes('vimeo.com/')) {
          const videoId = url.split('vimeo.com/')[1]?.split('?')[0]
          if (videoId) {
            embedUrl = `https://player.vimeo.com/video/${videoId}`
          }
        }

        const quillEditor = quillRef.current?.getEditor()
        if (quillEditor) {
          const range = quillEditor.getSelection(true)
          quillEditor.insertEmbed(range?.index || 0, 'video', embedUrl)
          quillEditor.setSelection((range?.index || 0) + 1, 0)
          console.log('Video embedded successfully:', embedUrl)
        }
      }
    }, [])

    // Memoize modules to prevent recreation on every render
    const modules = useMemo(() => {
      if (customModules) return customModules

      return {
        toolbar: {
          container: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            ['blockquote', 'code-block'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'script': 'sub'}, { 'script': 'super' }],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'align': [] }],
            ['link', 'image', 'video'],
            ['clean']
          ],
          handlers: {
            image: imageHandler,
            video: videoHandler
          }
        },
        clipboard: {
          // toggle to add extra line breaks when pasting HTML:
          matchVisual: false,
        }
      }
    }, [imageHandler, videoHandler, customModules])

    // Memoize formats
    const formats = useMemo(() => {
      if (customFormats) return customFormats

      return [
        'header',
        'bold', 'italic', 'underline', 'strike',
        'blockquote', 'code-block',
        'list', 'bullet',
        'script',
        'color', 'background',
        'align',
        'link', 'image', 'video'
      ]
    }, [customFormats])

    // Handle ref assignment
    useEffect(() => {
      if (ref) {
        if (typeof ref === 'function') {
          ref(quillRef.current)
        } else if (ref.current !== quillRef.current) {
          ref.current = quillRef.current
        }
      }
    }, [ref])

    // Stable change handler
    const handleChange = useCallback((content: string) => {
      if (onChange) {
        onChange(content)
      }
    }, [onChange])

    return (
      <div ref={containerRef} className={cn("rich-text-editor", className)}>
        <style>{`
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

          .rich-text-editor .ql-editor iframe {
            max-width: 100%;
            border-radius: 6px;
            margin: 8px 0;
          }

          .rich-text-editor .ql-editor img {
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            margin: 4px 0;
          }

          .rich-text-editor .ql-editor pre.ql-syntax {
            background-color: hsl(var(--muted));
            border: 1px solid hsl(var(--border));
            border-radius: 6px;
            padding: 12px;
            margin: 8px 0;
            font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.4;
            overflow-x: auto;
          }

          .rich-text-editor .ql-code-block-container {
            margin: 8px 0;
          }
        `}</style>

        <div suppressHydrationWarning>
          <ReactQuill
            ref={quillRef}
            theme={theme}
            value={value}
            onChange={handleChange}
            readOnly={readOnly}
            placeholder={placeholder}
            modules={modules}
            formats={formats}
            preserveWhitespace
            {...props}
          />
        </div>
      </div>
    )
  }
)

RichTextEditor.displayName = "RichTextEditor"

export { RichTextEditor }