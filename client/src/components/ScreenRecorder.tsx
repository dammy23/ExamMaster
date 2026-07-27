import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Monitor, AlertTriangle, CheckCircle, Minimize2, Maximize2, Move } from "lucide-react"
import { startScreenRecording, uploadScreenRecording } from "@/api/examAttempts"
import { getSocket } from "@/lib/socket"
import { useToast } from "@/hooks/useToast"

interface ScreenRecorderProps {
  attemptId: string
  onRecordingComplete?: (videoUrl: string) => void
}

export function ScreenRecorder({ attemptId, onRecordingComplete }: ScreenRecorderProps) {
  const { toast } = useToast()
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'stopped' | 'uploading' | 'completed'>('idle')
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [hasPermissions, setHasPermissions] = useState(false)
  const [permissionError, setPermissionError] = useState<string>("")

  // Floating window states -- offset to the right of VideoRecorder's default position
  // so both widgets don't stack exactly on top of each other when both are enabled
  const [position, setPosition] = useState({ x: 340, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [autoStarted, setAutoStarted] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const screenshotTimerRef = useRef<NodeJS.Timeout | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))

  useEffect(() => {
    if (!hasPermissions && !permissionError && !autoStarted) {
      setAutoStarted(true)
      requestPermissions().then(() => {
        setTimeout(() => {
          startRecording()
        }, 1000)
      }).catch((error) => {
        console.error('Screen share auto-start failed:', error)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      if (screenshotTimerRef.current) {
        clearInterval(screenshotTimerRef.current)
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  const requestPermissions = async () => {
    try {
      console.log('Requesting screen share permission...')
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 10 }
        }
      })

      setStream(mediaStream)
      setHasPermissions(true)
      setPermissionError("")

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }

      // Browsers show a native "Stop sharing" control outside the page's UI. If the
      // student uses it, route that through the same cleanup as the in-app stop path.
      mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopRecording()
      })

      console.log('Screen share permission granted successfully')
      toast({
        title: "Screen Share Access Granted",
        description: "Screen recording will start automatically for exam security",
      })

      return mediaStream
    } catch (error: any) {
      console.error('Error requesting screen share permission:', error)
      let errorMessage = "Failed to access screen sharing. "

      if (error.name === 'NotAllowedError') {
        errorMessage += "Please allow screen sharing for exam security."
      } else {
        errorMessage += error.message || "Unknown error occurred."
      }

      setPermissionError(errorMessage)
      toast({
        title: "Screen Share Error",
        description: errorMessage,
        variant: "destructive"
      })
      throw new Error(errorMessage)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
      setIsDragging(true)
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, dragOffset])

  const captureScreenshot = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const socket = getSocket()
    if (!video || !video.videoWidth || !socket) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.5)
    socket.emit('screenshot:capture', { attemptId, imageDataUrl })
  }

  const startRecording = async () => {
    try {
      console.log('Starting screen recording for attempt:', attemptId)

      let mediaStream = stream
      if (!mediaStream) {
        mediaStream = await requestPermissions()
      }

      if (!mediaStream) {
        throw new Error('No screen share stream available')
      }

      await startScreenRecording(attemptId)

      const recorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm;codecs=vp9'
      })

      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        setRecordedBlob(blob)
        setRecordingStatus('stopped')
        console.log('Screen recording stopped, blob size:', blob.size)
      }

      recorder.onerror = (event: any) => {
        console.error('Screen MediaRecorder error:', event.error)
        toast({
          title: "Recording Error",
          description: "Failed to record screen. Please try again.",
          variant: "destructive"
        })
        setRecordingStatus('idle')
        setIsRecording(false)
      }

      recorder.start(1000)
      setMediaRecorder(recorder)
      setIsRecording(true)
      setRecordingStatus('recording')
      setRecordingTime(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      screenshotTimerRef.current = setInterval(() => {
        captureScreenshot()
      }, 10000)

      console.log('Screen recording started successfully')
      toast({
        title: "Screen Recording Started",
        description: "Screen recording is now active for exam security",
      })

    } catch (error: any) {
      console.error('Error starting screen recording:', error)
      toast({
        title: "Recording Failed",
        description: error.message || "Failed to start screen recording",
        variant: "destructive"
      })
      setRecordingStatus('idle')
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    try {
      console.log('Stopping screen recording')

      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop()
      }

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }

      if (screenshotTimerRef.current) {
        clearInterval(screenshotTimerRef.current)
        screenshotTimerRef.current = null
      }

      setIsRecording(false)

      toast({
        title: "Screen Recording Stopped",
        description: "Screen recording has been stopped. Upload will begin automatically.",
      })

    } catch (error: any) {
      console.error('Error stopping screen recording:', error)
      toast({
        title: "Error",
        description: "Failed to stop screen recording properly",
        variant: "destructive"
      })
    }
  }

  const uploadRecording = async () => {
    if (!recordedBlob) {
      toast({
        title: "Error",
        description: "No screen recording available to upload",
        variant: "destructive"
      })
      return
    }

    try {
      setRecordingStatus('uploading')
      console.log('Uploading screen recording, size:', recordedBlob.size)

      const videoUrl = await uploadScreenRecording(attemptId, recordedBlob)

      setRecordingStatus('completed')
      console.log('Screen recording uploaded successfully:', videoUrl)

      toast({
        title: "Upload Complete",
        description: "Screen recording has been uploaded successfully",
      })

      if (onRecordingComplete) {
        onRecordingComplete(videoUrl)
      }

    } catch (error: any) {
      console.error('Error uploading screen recording:', error)
      setRecordingStatus('stopped')
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload screen recording",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    if (recordingStatus === 'stopped' && recordedBlob) {
      uploadRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingStatus, recordedBlob])

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getStatusBadge = () => {
    switch (recordingStatus) {
      case 'idle':
        return <Badge variant="secondary">Ready</Badge>
      case 'recording':
        return <Badge variant="destructive" className="animate-pulse">Recording</Badge>
      case 'stopped':
        return <Badge variant="outline">Stopped</Badge>
      case 'uploading':
        return <Badge variant="secondary">Uploading...</Badge>
      case 'completed':
        return <Badge variant="default" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Completed
        </Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  if (!hasPermissions && !permissionError) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Screen Recording Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This exam requires screen recording for security purposes. Please share your screen when prompted.
          </p>
          <Button onClick={requestPermissions} className="w-full">
            Share Screen
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (permissionError) {
    return (
      <Card className="w-full max-w-md border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Screen Share Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-destructive">{permissionError}</p>
          <Button onClick={requestPermissions} variant="outline" className="w-full">
            Retry Screen Share
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 ${
        isDragging ? 'cursor-grabbing' : 'cursor-default'
      } ${isMinimized ? 'w-64' : 'w-80'}`}
      style={{
        left: position.x,
        top: position.y,
        maxWidth: '90vw',
        maxHeight: '90vh'
      }}
    >
      <div
        className="flex items-center justify-between p-3 bg-gray-50 rounded-t-lg cursor-grab active:cursor-grabbing border-b"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <Move className="h-4 w-4 text-gray-500" />
          <Monitor className="h-4 w-4" />
          <span className="text-sm font-medium">Screen Recording</span>
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-6 w-6 p-0"
          >
            {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-3 space-y-3">
          <div className="relative bg-black rounded-md overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {isRecording && (
              <div className="absolute top-1 right-1 flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded text-xs">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                REC {formatTime(recordingTime)}
              </div>
            )}
          </div>

          <div className="text-xs text-center text-gray-600">
            {recordingStatus === 'recording' && (
              <p>Screen recording active for exam security</p>
            )}
            {recordingStatus === 'uploading' && (
              <p>Uploading recording...</p>
            )}
            {recordingStatus === 'completed' && (
              <p className="text-green-600">Recording completed ✓</p>
            )}
          </div>
        </div>
      )}

      {isMinimized && (
        <div className="px-3 py-2 text-xs text-center text-gray-600">
          {recordingStatus === 'recording' && `Recording: ${formatTime(recordingTime)}`}
          {recordingStatus === 'uploading' && 'Uploading...'}
          {recordingStatus === 'completed' && 'Completed ✓'}
        </div>
      )}
    </div>
  )
}
