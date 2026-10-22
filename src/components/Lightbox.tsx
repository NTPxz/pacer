import { useEffect, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { canShareFiles, saveOrShare, type Overlay, type PhotoStats } from '../lib/overlay'
import { Photo } from './Photo'

export function Lightbox({
  photos,
  overlays,
  stats,
  start,
  title,
  sub,
  onClose,
}: {
  photos: string[]
  overlays?: Record<string, Overlay>
  stats: PhotoStats
  start: number
  title: string
  sub: string
  onClose: () => void
}) {
  const [[i, dir], setPage] = useState<[number, number]>([start, 0])
  const [saving, setSaving] = useState(false)
  const shareable = canShareFiles()
  const exportPhoto = async (share: boolean) => {
    setSaving(true)
    try {
      const slug = title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'race'
      await saveOrShare(photos[i], overlays?.[photos[i]], stats, `tayan-${slug}-${i + 1}.jpg`, share)
    } catch {
      /* user cancelled the share sheet */
    } finally {
      setSaving(false)
    }
  }
  const go = (d: number) => setPage(([cur]) => [(cur + d + photos.length) % photos.length, d])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (photos.length < 2) return
    if (info.offset.x < -60 || info.velocity.x < -400) go(1)
    else if (info.offset.x > 60 || info.velocity.x > 400) go(-1)
  }

  return (
    <motion.div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`รูปจาก ${title}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="ปิด">
        ×
      </button>

      <div className="lightbox-stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={photos[i]}
            className="lightbox-frame"
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d * 120, opacity: 0, rotate: d * 3 }),
              center: { x: 0, opacity: 1, rotate: 0 },
              exit: (d: number) => ({ x: d * -120, opacity: 0, rotate: d * -3 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            drag={photos.length > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={onDragEnd}
          >
            <Photo
              id={photos[i]}
              alt={`${title} รูปที่ ${i + 1}`}
              layoutId={dir === 0 ? `photo-${photos[i]}` : undefined}
              overlay={overlays?.[photos[i]]}
              stats={stats}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {photos.length > 1 && (
        <>
          <button type="button" className="lightbox-nav prev" onClick={() => go(-1)} aria-label="รูปก่อนหน้า">
            ←
          </button>
          <button type="button" className="lightbox-nav next" onClick={() => go(1)} aria-label="รูปถัดไป">
            →
          </button>
        </>
      )}

      <footer className="lightbox-caption">
        <div>
          <strong>{title}</strong>
          <span>{sub}</span>
        </div>
        <div className="lightbox-actions">
          <button type="button" onClick={() => exportPhoto(false)} disabled={saving}>
            {saving ? 'กำลังเตรียม…' : 'บันทึกรูป'}
          </button>
          {shareable && (
            <button type="button" className="is-primary" onClick={() => exportPhoto(true)} disabled={saving}>
              แชร์
            </button>
          )}
        </div>
        {photos.length > 1 && (
          <div className="lightbox-dots" role="tablist">
            {photos.map((p, k) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={k === i}
                aria-label={`รูปที่ ${k + 1}`}
                className={k === i ? 'is-active' : ''}
                onClick={() => setPage([k, k > i ? 1 : -1])}
              />
            ))}
          </div>
        )}
      </footer>
    </motion.div>
  )
}
