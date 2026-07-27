import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Monitor } from "lucide-react"

interface ScreenShareGateProps {
  mode: 'initial' | 'reshare'
  error: string
  onRetry: () => void
}

export function ScreenShareGate({ mode, error, onRetry }: ScreenShareGateProps) {
  const hasError = Boolean(error)

  const defaultMessage = mode === 'initial'
    ? 'This exam requires you to share your entire screen. Please select "Entire Screen" when prompted.'
    : 'Your screen share has stopped. You must re-share your entire screen to continue the exam. The timer has not been paused.'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <Card className={`w-full max-w-md ${hasError ? 'border-destructive' : ''}`}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${hasError ? 'text-destructive' : ''}`}>
            {hasError ? <AlertTriangle className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            {mode === 'initial' ? 'Entire Screen Sharing Required' : 'Screen Sharing Lost'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className={`text-sm ${hasError ? 'text-destructive' : 'text-muted-foreground'}`}>
            {error || defaultMessage}
          </p>
          <Button onClick={onRetry} className="w-full">
            {hasError ? 'Retry Screen Share' : 'Share Entire Screen'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
