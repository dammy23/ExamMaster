export class WrongSurfaceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WrongSurfaceError'
  }
}

export async function requestEntireScreenShare(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: 'monitor',
      frameRate: { ideal: 10 }
    } as MediaTrackConstraints
  })

  const [track] = stream.getVideoTracks()
  const settings = track.getSettings() as MediaTrackSettings & { displaySurface?: string }

  if (settings.displaySurface !== 'monitor') {
    stream.getTracks().forEach(t => t.stop())
    throw new WrongSurfaceError(
      'You must share your Entire Screen, not a window or a browser tab. Please try again and select "Entire Screen".'
    )
  }

  return stream
}
