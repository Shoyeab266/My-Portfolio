import { useLayoutEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../lib/gsap'

const FROM = { y: 60, scale: 0.92, opacity: 0 }
const TO = {
  y: 0,
  scale: 1,
  opacity: 1,
  duration: 0.8,
  ease: 'back.out',
}

function useScrollPopIn(itemIds) {
  const containerRef = useRef(null)
  const animatedIds = useRef(new Set())
  const idsKey = itemIds.join(',')

  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root) return undefined

    const present = new Set(idsKey ? idsKey.split(',') : [])
    for (const id of [...animatedIds.current]) {
      if (!present.has(id)) animatedIds.current.delete(id)
    }

    const cards = gsap.utils.toArray('[data-pop-id]', root)
    let stagger = 0

    cards.forEach((card) => {
      const id = String(card.dataset.popId)
      if (animatedIds.current.has(id)) return
      animatedIds.current.add(id)

      gsap.set(card, FROM)
      gsap.to(card, {
        ...TO,
        delay: stagger,
        scrollTrigger: {
          trigger: card,
          start: 'top 88%',
          once: true,
        },
      })
      stagger += 0.12
    })

    const refresh = () => ScrollTrigger.refresh()
    requestAnimationFrame(refresh)

    return undefined
  }, [idsKey])

  useLayoutEffect(() => {
    const root = containerRef.current
    return () => {
      ScrollTrigger.getAll().forEach((trigger) => {
        if (root && (trigger.trigger === root || root.contains(trigger.trigger))) {
          trigger.kill()
        }
      })
      animatedIds.current.clear()
    }
  }, [])

  return containerRef
}

export default useScrollPopIn
