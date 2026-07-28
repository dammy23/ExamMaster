import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Video, VideoOff, Mic, MicOff, Play, Square, AlertTriangle, CheckCircle, Minimize2, Maximize2, Move } from "lucide-react"
import { startVideoRecording, uploadVideoRecording } from "@/api/examAttempts"
import { useToast } from "@/hooks/useToast"

interface VideoRecorderProps {
  attemptId: string
  onRecordingComplete?: (videoUrl: string) => void
}

export interface VideoRecorderHandle {
  // Stops any active recording and waits for its upload to finish (or to give
  // up), so a caller can be sure the video is saved before tearing the page
  // down -- unmounting alone only stops the stream, it never finalizes the
  // MediaRecorder or uploads the buffered chunks.
  finalize: () => Promise<void>
}

export const VideoRecorder = forwardRef<VideoRecorderHandle, VideoRecorderProps>(function VideoRecorder(
  { attemptId, onRecordingComplete },
  ref
) {
  const { toast } = useToast()
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'stopped' | 'uploading' | 'completed'>('idle')
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [hasPermissions, setHasPermissions] = useState(false)
  const [permissionError, setPermissionError] = useState<string>("")
  
  // Floating window states
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [autoStarted, setAutoStarted] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const finalizeResolveRef = useRef<(() => void) | null>(null)

  const resolveFinalize = () => {
    if (finalizeResolveRef.current) {
      finalizeResolveRef.current()
      finalizeResolveRef.current = null
    }
  }

  useEffect(() => {
    // Auto-request permissions and start recording when component mounts
    if (!hasPermissions && !permissionError && !autoStarted) {
      setAutoStarted(true)
      requestPermissions().then(() => {
        // Auto-start recording after a short delay to ensure everything is ready
        setTimeout(() => {
          startRecording()
        }, 1000)
      }).catch((error) => {
        console.error('Auto-start failed:', error)
      })
    }
  }, [])

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  const requestPermissions = async () => {
    try {
      console.log('Requesting camera and microphone permissions...')
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      setStream(mediaStream)
      setHasPermissions(true)
      setPermissionError("")
      
      // Show preview
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }

      console.log('Media permissions granted successfully')
      toast({
        title: "Camera & Microphone Access Granted",
        description: "Video recording will start automatically for exam security",
      })

      return mediaStream
    } catch (error: any) {
      console.error('Error requesting media permissions:', error)
      let errorMessage = "Failed to access camera and microphone. "
      
      if (error.name === 'NotAllowedError') {
        errorMessage += "Please allow camera and microphone access for exam security."
      } else if (error.name === 'NotFoundError') {
        errorMessage += "No camera or microphone found on your device."
      } else if (error.name === 'NotReadableError') {
        errorMessage += "Camera or microphone is being used by another application."
      } else {
        errorMessage += error.message || "Unknown error occurred."
      }

      setPermissionError(errorMessage)
      toast({
        title: "Media Access Error",
        description: errorMessage,
        variant: "destructive"
      })
      throw new Error(errorMessage)
    }
  }

  // Drag functionality
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

  // Add event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  const startRecording = async () => {
    try {
      console.log('Starting video recording for attempt:', attemptId)
      
      let mediaStream = stream
      if (!mediaStream) {
        mediaStream = await requestPermissions()
      }

      if (!mediaStream) {
        throw new Error('No media stream available')
      }

      // Notify backend that recording is starting
      await startVideoRecording(attemptId)

      // Create MediaRecorder
      const recorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm;codecs=vp9,opus'
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
        console.log('Recording stopped, blob size:', blob.size)
      }

      recorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event.error)
        toast({
          title: "Recording Error",
          description: "Failed to record video. Please try again.",
          variant: "destructive"
        })
        setRecordingStatus('idle')
        setIsRecording(false)
      }

      recorder.start(1000) // Record in 1-second chunks
      setMediaRecorder(recorder)
      setIsRecording(true)
      setRecordingStatus('recording')
      setRecordingTime(0)

      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      console.log('Video recording started successfully')
      toast({
        title: "Recording Started",
        description: "Video recording is now active for exam security",
      })

    } catch (error: any) {
      console.error('Error starting recording:', error)
      toast({
        title: "Recording Failed",
        description: error.message || "Failed to start video recording",
        variant: "destructive"
      })
      setRecordingStatus('idle')
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    try {
      console.log('Stopping video recording')
      
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop()
      }

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }

      setIsRecording(false)
      
      toast({
        title: "Recording Stopped",
        description: "Video recording has been stopped. Upload will begin automatically.",
      })

    } catch (error: any) {
      console.error('Error stopping recording:', error)
      toast({
        title: "Error",
        description: "Failed to stop recording properly",
        variant: "destructive"
      })
    }
  }

  const uploadRecording = async () => {
    if (!recordedBlob) {
      toast({
        title: "Error",
        description: "No recording available to upload",
        variant: "destructive"
      })
      resolveFinalize()
      return
    }

    try {
      setRecordingStatus('uploading')
      console.log('Uploading video recording, size:', recordedBlob.size)

      const videoUrl = await uploadVideoRecording(attemptId, recordedBlob)
      
      setRecordingStatus('completed')
      console.log('Video uploaded successfully:', videoUrl)
      
      toast({
        title: "Upload Complete",
        description: "Video recording has been uploaded successfully",
      })

      if (onRecordingComplete) {
        onRecordingComplete(videoUrl)
      }

    } catch (error: any) {
      console.error('Error uploading recording:', error)
      setRecordingStatus('stopped')
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload video recording",
        variant: "destructive"
      })
    } finally {
      resolveFinalize()
    }
  }

  // Auto-upload when recording stops
  useEffect(() => {
    if (recordingStatus === 'stopped' && recordedBlob) {
      uploadRecording()
    }
  }, [recordingStatus, recordedBlob])

  useImperativeHandle(ref, () => ({
    finalize: () => new Promise<void>((resolve) => {
      if (recordingStatus === 'recording') {
        finalizeResolveRef.current = resolve
        stopRecording()
      } else if (recordingStatus === 'uploading' || recordingStatus === 'stopped') {
        finalizeResolveRef.current = resolve
      } else {
        resolve()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [recordingStatus])

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
            <Video className="h-5 w-5" />
            Video Security Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This exam requires video recording for security purposes. Please grant camera and microphone access.
          </p>
          <Button onClick={requestPermissions} className="w-full">
            Grant Camera & Microphone Access
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
            Media Access Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-destructive">{permissionError}</p>
          <Button onClick={requestPermissions} variant="outline" className="w-full">
            Retry Access Request
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
      {/* Header with drag handle */}
      <div
        className="flex items-center justify-between p-3 bg-gray-50 rounded-t-lg cursor-grab active:cursor-grabbing border-b"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <Move className="h-4 w-4 text-gray-500" />
          <Video className="h-4 w-4" />
          <span className="text-sm font-medium">Recording</span>
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

      {/* Content */}
      {!isMinimized && (
        <div className="p-3 space-y-3">
          {/* Video Preview */}
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

          {/* Controls - Only show stop button if auto-recording */}
          {/*isRecording && (
            <div className="flex items-center justify-center">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1">
                    <Square className="h-3 w-3" />
                    Stop Recording
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Stop Recording?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to stop the video recording? The recording will be automatically uploaded for exam security.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Continue Recording</AlertDialogCancel>
                    <AlertDialogAction onClick={stopRecording}>
                      Stop & Upload
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )*/}

          {/* Status Information */}
          <div className="text-xs text-center text-gray-600">
            {recordingStatus === 'recording' && (
              <p>Recording active for exam security</p>
            )}
            {recordingStatus === 'uploading' && (
              <p>Uploading video...</p>
            )}
            {recordingStatus === 'completed' && (
              <p className="text-green-600">Recording completed ✓</p>
            )}
          </div>
        </div>
      )}

      {/* Minimized view */}
      {isMinimized && (
        <div className="px-3 py-2 text-xs text-center text-gray-600">
          {recordingStatus === 'recording' && `Recording: ${formatTime(recordingTime)}`}
          {recordingStatus === 'uploading' && 'Uploading...'}
          {recordingStatus === 'completed' && 'Completed ✓'}
        </div>
      )}
    </div>
  )
})