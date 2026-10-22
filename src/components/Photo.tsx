import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { compositeUrl, type Overlay, type PhotoStats } from '../lib/overlay'
import { photoUrl } from '../lib/photos'

interface Props {
  id: string
  alt: string
  layoutId?: string
  className?: string
  /** burn a stat overlay into the photo (rendered on canvas) */
  overlay?: Overlay
  stats?: PhotoStats
  maxEdge?: number
  /** size the frame to the photo's own aspect ratio, clamped so cards stay tidy */
  natural?: boolean
}

/** an IndexedDB-backed photo; fades in once decoded and keeps the old frame while a new overlay renders */
export function Photo({ id, alt, layoutId, className, overlay, stats, maxEdge = 1600, natural }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [ratio, setRatio] = useState<number | null>(null)
  const key = overlay && stats ? JSON.stringify([overlay, stats]) : ''

  useEffect(() => setReady(false), [id])

  useEffect(() => {
    let live = true
    const p = overlay && stats ? compositeUrl(id, overlay, stats, maxEdge) : photoUrl(id)
    p.then((u) => live && setSrc(u))
    return () => {
      live = false
    }
    // key captures overlay + stats by value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key, maxEdge])

  return (
    <span
      className={`photo ${className ?? ''}`}
      style={natural && ratio ? { aspectRatio: String(Math.min(1.5, Math.max(0.75, ratio))) } : undefined}
    >
      {src && (
        <motion.img
          layoutId={layoutId}
          src={src}
          alt={alt}
          draggable={false}
          onLoad={(e) => {
            setReady(true)
            const img = e.currentTarget
            if (img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight)
          }}
          initial={false}
          animate={{ opacity: ready ? 1 : 0 }}
          transition={{ duration: 0.35 }}
        />
      )}
    </span>
  )
}
