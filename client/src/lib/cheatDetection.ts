const VM_RENDERER_SUBSTRINGS = [
  'SwiftShader',
  'llvmpipe',
  'VMware',
  'VirtualBox',
  'Microsoft Basic Render Driver',
  'Parallels',
]

// Sourced from a publicly documented extension-detection example
// (https://www.codestudy.net/blog/check-whether-user-has-a-chrome-extension-installed/).
// Confirm this resource path against a real Grammarly install before relying on it in
// production — extension IDs and web-accessible resources can change between versions.
const EXTENSION_PROBES: { name: string; url: string }[] = [
  {
    name: 'Grammarly',
    url: 'chrome-extension://kbfnbcaeplbcioakkpcpgfkobkghlhen/src/css/Grammarly.styles.css',
  },
]

export function detectMultiMonitor(): boolean {
  return Boolean((window.screen as any).isExtended)
}

export function detectVmIndicator(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return false

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (!debugInfo) return false

    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    if (typeof renderer !== 'string') return false

    const lowerRenderer = renderer.toLowerCase()
    return VM_RENDERER_SUBSTRINGS.some(substring =>
      lowerRenderer.includes(substring.toLowerCase())
    )
  } catch {
    return false
  }
}

export async function probeSuspiciousExtensions(): Promise<boolean> {
  const results = await Promise.all(
    EXTENSION_PROBES.map(async ({ url }) => {
      try {
        await fetch(url)
        return true
      } catch {
        return false
      }
    })
  )
  return results.some(Boolean)
}

export function createDevToolsWatcher(
  onOpen: () => void,
  thresholdPx = 160,
  intervalMs = 1500
): () => void {
  let wasOpen = false

  const check = () => {
    const widthDelta = window.outerWidth - window.innerWidth
    const heightDelta = window.outerHeight - window.innerHeight
    const isOpen = widthDelta > thresholdPx || heightDelta > thresholdPx

    if (isOpen && !wasOpen) {
      onOpen()
    }
    wasOpen = isOpen
  }

  const interval = setInterval(check, intervalMs)
  return () => clearInterval(interval)
}
