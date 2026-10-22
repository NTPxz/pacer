import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { photoUrl } from '../lib/photos'

/** an IndexedDB-backed photo; fades in once decoded */
export function Photo({ id, alt, layoutId, className }: { id: string; alt: string; layoutId?: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let live = true
    setReady(false)
    photoUrl(id).then((u) => live && setSrc(u))
    return () => {
      live = false
    }
  }, [id])

  return (
    <span className={`photo ${className ?? ''}`} data-missing={src === null && ready ? true : undefined}>
      {src && (
        <motion.img
          layoutId={layoutId}
          src={src}
          alt={alt}
          draggable={false}
          onLoad={() => setReady(true)}
          initial={false}
          animate={{ opacity: ready ? 1 : 0 }}
          transition={{ duration: 0.35 }}
        />
      )}
    </span>
  )
}
