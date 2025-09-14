import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Video, VideoOff, Mic, MicOff, Play, Square, AlertTriangle, CheckCircle } from "lucide-react"
import { startVideoRecording, uploadVideoRecording } from "@/api/examAttempts"
import { useToast } from "@/hooks/useToast"

interface VideoRecorderProps {
  attemptId: string
  onRecordingComplete?: (videoUrl: string) => void
}

export function VideoRecorder({ attemptId, onRecordingComplete }: VideoRecorderProps) {
  const { toast } = useToast()
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'stopped' | 'uploading' | 'completed'>('idle')
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [hasPermissions, setHasPermissions] = useState(false)
  const [permissionError, setPermissionError] = useState<string>("")

  const videoRef = useRef<HTMLVideoElement>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const chunksRef = useRef<Blob[]>([])

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
        description: "Ready to start video recording for exam security",
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
    }
  }

  // Auto-upload when recording stops
  useEffect(() => {
    if (recordingStatus === 'stopped' && recordedBlob) {
      uploadRecording()
    }
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
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Exam Security Recording
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Preview */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {isRecording && (
            <div className="absolute top-2 right-2 flex items-center gap-2 bg-red-600 text-white px-2 py-1 rounded-md text-sm">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              REC {formatTime(recordingTime)}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {!isRecording ? (
            <Button 
              onClick={startRecording} 
              disabled={recordingStatus === 'uploading' || recordingStatus === 'completed'}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Start Recording
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Square className="h-4 w-4" />
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
          )}
        </div>

        {/* Status Information */}
        <div className="text-xs text-center text-muted-foreground space-y-1">
          {recordingStatus === 'recording' && (
            <p>Recording in progress... Do not close this tab.</p>
          )}
          {recordingStatus === 'uploading' && (
            <p>Uploading video for security review...</p>
          )}
          {recordingStatus === 'completed' && (
            <p>Video security recording completed successfully.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}