import { forwardRef, useRef, useEffect } from "react"
import { CKEditor } from '@ckeditor/ckeditor5-react'
import {
  ClassicEditor,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Subscript,
  Superscript,
  Link,
  Paragraph,
  Heading,
  BlockQuote,
  CodeBlock,
  List,
  TodoList,
  Indent,
  IndentBlock,
  Alignment,
  FontColor,
  FontBackgroundColor,
  FontFamily,
  FontSize,
  Image,
  ImageCaption,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  ImageResize,
  Base64UploadAdapter,
  Essentials,
  SourceEditing
} from 'ckeditor5'
import { cn } from "@/lib/utils"
import { uploadImage } from "@/api/upload"

import 'ckeditor5/ckeditor5.css'

interface RichTextEditorProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  readOnly?: boolean
  height?: string
  onReady?: (editor: any) => void
}

// Custom upload adapter for CKEditor
class CustomUploadAdapter {
  private loader: any

  constructor(loader: any) {
    this.loader = loader
  }

  upload() {
    return this.loader.file
      .then((file: File) => {
        console.log('CKEditor: Starting image upload:', file.name)
        return uploadImage(file)
      })
      .then((response: any) => {
        console.log('CKEditor: Image upload successful:', response)
        return {
          default: response.imageUrl
        }
      })
      .catch((error: any) => {
        console.error('CKEditor: Image upload failed:', error)
        throw error
      })
  }

  abort() {
    // Implement if needed
  }
}

// Plugin to integrate custom upload adapter
function CustomUploadAdapterPlugin(editor: any) {
  editor.plugins.get('FileRepository').createUploadAdapter = (loader: any) => {
    return new CustomUploadAdapter(loader)
  }
}

const RichTextEditor = forwardRef<any, RichTextEditorProps>(
  ({
    value = '',
    onChange,
    placeholder = 'Start typing...',
    className,
    readOnly = false,
    height = "200px",
    onReady,
    ...props
  }, ref) => {
    const editorRef = useRef<any>(null)

    useEffect(() => {
      if (ref && editorRef.current) {
        if (typeof ref === 'function') {
          ref(editorRef.current)
        } else {
          ref.current = editorRef.current
        }
      }
    }, [ref])

    const editorConfiguration = {
      plugins: [
        Essentials,
        Bold,
        Italic,
        Underline,
        Strikethrough,
        Code,
        Subscript,
        Superscript,
        Link,
        Paragraph,
        Heading,
        BlockQuote,
        CodeBlock,
        List,
        TodoList,
        Indent,
        IndentBlock,
        Alignment,
        FontColor,
        FontBackgroundColor,
        FontFamily,
        FontSize,
        Image,
        ImageCaption,
        ImageStyle,
        ImageToolbar,
        ImageUpload,
        ImageResize,
        Base64UploadAdapter,
        SourceEditing,
        CustomUploadAdapterPlugin
      ],
      toolbar: {
        items: [
          'heading',
          '|',
          'bold',
          'italic',
          'underline',
          'strikethrough',
          '|',
          'fontFamily',
          'fontSize',
          'fontColor',
          'fontBackgroundColor',
          '|',
          'alignment',
          '|',
          'numberedList',
          'bulletedList',
          'todoList',
          '|',
          'outdent',
          'indent',
          '|',
          'link',
          'imageUpload',
          'blockQuote',
          'codeBlock',
          '|',
          'code',
          'subscript',
          'superscript',
          '|',
          'sourceEditing'
        ]
      },
      heading: {
        options: [
          { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
          { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
          { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
          { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' }
        ]
      },
      image: {
        toolbar: [
          'imageTextAlternative',
          '|',
          'imageStyle:inline',
          'imageStyle:block',
          'imageStyle:side',
          '|',
          'toggleImageCaption',
          'imageResize'
        ]
      },
      placeholder: placeholder,
      ...props
    }

    return (
      <div className={cn("rich-text-editor", className)}>
        <style>{`
          .rich-text-editor .ck-editor {
            border-radius: 6px;
            border: 1px solid hsl(var(--border));
          }

          .rich-text-editor .ck-toolbar {
            border-top-left-radius: 6px;
            border-top-right-radius: 6px;
            border: 1px solid hsl(var(--border));
            border-bottom: none;
            background: hsl(var(--background));
          }

          .rich-text-editor .ck-content {
            border-bottom-left-radius: 6px;
            border-bottom-right-radius: 6px;
            border: 1px solid hsl(var(--border));
            border-top: none;
            background: hsl(var(--background));
            color: hsl(var(--foreground));
            min-height: ${height};
            font-size: 14px;
            line-height: 1.5;
          }

          .rich-text-editor .ck-content.ck-focused {
            border-color: hsl(var(--ring));
            outline: 2px solid transparent;
            outline-offset: 2px;
            box-shadow: 0 0 0 2px hsl(var(--ring));
          }

          .rich-text-editor .ck-button:hover {
            background-color: hsl(var(--muted));
          }

          .rich-text-editor .ck-button.ck-on {
            background-color: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
          }

          .rich-text-editor .ck-dropdown__button:hover {
            background-color: hsl(var(--muted));
          }

          .rich-text-editor .ck-content p {
            margin: 0 0 8px 0;
          }

          .rich-text-editor .ck-content h1,
          .rich-text-editor .ck-content h2,
          .rich-text-editor .ck-content h3 {
            margin: 0 0 12px 0;
          }

          .rich-text-editor .ck-content ul,
          .rich-text-editor .ck-content ol {
            margin: 0 0 8px 0;
            padding-left: 24px;
          }

          .rich-text-editor .ck-content blockquote {
            margin: 0 0 8px 0;
            padding-left: 16px;
            border-left: 4px solid hsl(var(--border));
            font-style: italic;
          }

          .rich-text-editor .ck-content img {
            max-width: 100%;
            height: auto;
          }

          .rich-text-editor .ck-placeholder::before {
            color: hsl(var(--muted-foreground));
          }
        `}</style>

        <CKEditor
          editor={ClassicEditor}
          config={editorConfiguration}
          data={value}
          disabled={readOnly}
          onReady={(editor) => {
            console.log('CKEditor is ready:', editor)
            editorRef.current = editor
            if (onReady) {
              onReady(editor)
            }
          }}
          onChange={(event, editor) => {
            const data = editor.getData()
            if (onChange) {
              onChange(data)
            }
          }}
          onError={(error, { willEditorRestart }) => {
            console.error('CKEditor error:', error)
            if (willEditorRestart) {
              console.log('CKEditor will restart...')
            }
          }}
        />
      </div>
    )
  }
)

RichTextEditor.displayName = "RichTextEditor"

export { RichTextEditor }