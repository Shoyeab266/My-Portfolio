import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { gsap } from '../lib/gsap'
import { contact } from '../data/contact'
import portraitPoints from '../data/portrait-points.json'

// ==========================================
// Intro Animation Timing Configuration
// ==========================================

// Duration for particles to spring & jiggle into the word 'Hey!' (Unit: seconds)
const HEY_FORM_DURATION = 2

// Hold time while the word 'Hey!' remains visible on screen (Unit: seconds)
const HEY_HOLD_DURATION = 0.6

// Duration for particles to scatter burst & re-form into 'I am Mohd Shoyab' (Unit: seconds)
const SHOYAB_FORM_DURATION = 2

// Hold time while 'I am Mohd Shoyab' remains visible on screen (Unit: seconds)
const SHOYAB_HOLD_DURATION = 0.6

// Fade-out time for 'I am Mohd Shoyab' particles to scatter away and fade to 0 opacity (Unit: seconds)
const PARTICLES_FADE_OUT_DURATION = 2

// Pause / clean break after particles disappear before the hero text fades in (Unit: seconds)
const PAUSE_BEFORE_HERO_TEXT = 0.5

// Duration for hero heading, description, and action buttons to fade in (Unit: seconds)
const HERO_TEXT_FADE_DURATION = 1.2

// Stagger delay between each hero text element as they fade in (Unit: seconds)
const HERO_TEXT_STAGGER = 0.18

// Pause / hold time showing only the hero heading and description before the portrait forms (Unit: seconds)
const PAUSE_BEFORE_PORTRAIT = 1

// Duration for portrait particles to spawn at screen edges and settle inward into portrait (Unit: seconds)
const PORTRAIT_SETTLE_DURATION = 4.0

const dotSize = 3
const particleCount = 1800
const JIGGLE_AMOUNT = 14
const SPRING_STRENGTH = 0.055
const DAMPING = 0.86
const SHIMMER = 0.35

function getHeyFontSize(w, h) {
  let fs = Math.min(w * 0.22, (h || w) * 0.34, 230)
  const approxW = 4 * fs * 0.65
  const maxW = w * 0.8
  if (approxW > maxW) {
    fs = Math.floor(fs * (maxW / approxW))
  }
  return Math.max(fs, 44)
}

function getshoyabFontSize(w, h) {
  let fs = Math.min(w * 0.11, (h || w) * 0.22, 125)
  const approxW = 11 * fs * 0.62
  const maxW = w * 0.84
  if (approxW > maxW) {
    fs = Math.floor(fs * (maxW / approxW))
  }
  return Math.max(fs, 28)
}

function sampleTextPoints(text, width, height, targetCount, scaleType = 'auto') {
  const canvas = document.createElement('canvas')
  const w = Math.max(320, Math.round(width))
  const h = Math.max(240, Math.round(height))
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, w, h)

  let fontSize
  if (scaleType === 'large' || text.length <= 4) {
    fontSize = getHeyFontSize(w, h)
  } else {
    fontSize = getshoyabFontSize(w, h)
  }

  ctx.font = `900 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, w / 2, h / 2)

  const { data } = ctx.getImageData(0, 0, w, h)
  const candidates = []
  const step = 2

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const idx = (y * w + x) * 4
      const alpha = data[idx + 3]
      const brightness = data[idx]
      if (alpha > 70 && brightness > 70) {
        candidates.push({
          x: x - w / 2,
          y: h / 2 - y,
        })
      }
    }
  }

  if (candidates.length === 0) return { points: [], fontSize }

  const picked = []
  const pickStep = candidates.length / targetCount
  for (let i = 0; i < targetCount; i += 1) {
    picked.push(candidates[Math.floor(i * pickStep)])
  }

  return { points: picked, fontSize }
}

function createDotTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.55, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.85, 'rgba(255,255,255,0.85)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function Hero() {
  const [open, setOpen] = useState(false)
  const [sequenceComplete, setSequenceComplete] = useState(false)

  const menuRef = useRef(null)
  const heroRef = useRef(null)
  const copyRef = useRef(null)
  const h1Ref = useRef(null)
  const descRef = useRef(null)
  const actionsRef = useRef(null)
  const portraitPlaceholderRef = useRef(null)
  const canvasWrapRef = useRef(null)
  const timelineRef = useRef(null)

  // Handle contact dropdown clicks
  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  // Master Particle System & GSAP Timeline
  useEffect(() => {
    const heroEl = heroRef.current
    const canvasWrap = canvasWrapRef.current
    const portraitEl = portraitPlaceholderRef.current
    if (!heroEl || !canvasWrap || !portraitEl) return undefined

    const isDisposed = { current: false }
    const threeHolder = {
      renderer: null,
      scene: null,
      camera: null,
      pointsMesh: null,
      geometry: null,
      material: null,
      texture: null,
    }
    const animIdHolder = { current: 0 }

    const arrays = {
      positions: null,
      physicsX: null,
      physicsY: null,
      velocityX: null,
      velocityY: null,
      speedCap: null,
      homeHeyX: null,
      homeHeyY: null,
      normHeyX: null,
      normHeyY: null,
      homeshoyabX: null,
      homeshoyabY: null,
      normshoyabX: null,
      normshoyabY: null,
      homePortraitX: null,
      homePortraitY: null,
      normPortraitX: null,
      normPortraitY: null,
      phase: null,
    }

    const timeHolder = { lastFrame: performance.now() }

    // State object animated by GSAP
    const animState = {
      stage: 'hey', // 'hey' | 'shoyab' | 'portrait'
      wobble: 1, // 1 to 0 for spring jiggle
      particleOpacity: 1, // 1 to 0 for fading
    }

    function triggerScatter(minSpeed = 260, maxSpeed = 380) {
      for (let i = 0; i < particleCount; i += 1) {
        const angle = Math.atan2(arrays.physicsY[i], arrays.physicsX[i]) + (Math.random() - 0.5) * 1.5
        const burstSpeed = minSpeed + Math.random() * (maxSpeed - minSpeed)
        arrays.velocityX[i] += Math.cos(angle) * burstSpeed
        arrays.velocityY[i] += Math.sin(angle) * burstSpeed
      }
    }

    function spawnAroundScreenEdges() {
      const width = canvasWrap.clientWidth || heroEl.clientWidth || window.innerWidth
      const height = canvasWrap.clientHeight || heroEl.clientHeight || window.innerHeight
      const halfW = width / 2
      const halfH = height / 2

      for (let i = 0; i < particleCount; i += 1) {
        // Distribute across top, bottom, left, right edges and 4 corners
        const zone = i % 8
        let px = 0
        let py = 0

        if (zone === 0) {
          // Top edge
          px = (Math.random() - 0.5) * width
          py = halfH + (Math.random() * 30 - 10)
        } else if (zone === 1) {
          // Bottom edge
          px = (Math.random() - 0.5) * width
          py = -halfH - (Math.random() * 30 - 10)
        } else if (zone === 2) {
          // Left edge
          px = -halfW - (Math.random() * 30 - 10)
          py = (Math.random() - 0.5) * height
        } else if (zone === 3) {
          // Right edge
          px = halfW + (Math.random() * 30 - 10)
          py = (Math.random() - 0.5) * height
        } else if (zone === 4) {
          // Top-Left corner
          px = -halfW + (Math.random() - 0.5) * 60
          py = halfH + (Math.random() - 0.5) * 60
        } else if (zone === 5) {
          // Top-Right corner
          px = halfW + (Math.random() - 0.5) * 60
          py = halfH + (Math.random() - 0.5) * 60
        } else if (zone === 6) {
          // Bottom-Left corner
          px = -halfW + (Math.random() - 0.5) * 60
          py = -halfH + (Math.random() - 0.5) * 60
        } else {
          // Bottom-Right corner
          px = halfW + (Math.random() - 0.5) * 60
          py = -halfH + (Math.random() - 0.5) * 60
        }

        arrays.physicsX[i] = px
        arrays.physicsY[i] = py
        arrays.velocityX[i] = 0
        arrays.velocityY[i] = 0

        if (arrays.positions) {
          arrays.positions[i * 3] = px
          arrays.positions[i * 3 + 1] = py
          arrays.positions[i * 3 + 2] = 0
        }

        // Calculate initial distance to target to normalize arrival speed across 4 seconds
        const targetX = arrays.homePortraitX ? arrays.homePortraitX[i] : 0
        const targetY = arrays.homePortraitY ? arrays.homePortraitY[i] : 0
        const dx = targetX - px
        const dy = targetY - py
        const initDist = Math.sqrt(dx * dx + dy * dy)
        if (arrays.speedCap) {
          arrays.speedCap[i] = Math.max(2.2, Math.min(8.5, (initDist / 220) * 1.3))
        }
      }

      if (threeHolder.geometry) {
        threeHolder.geometry.attributes.position.needsUpdate = true
      }
    }

    function getPortraitTransform(w, h) {
      if (!heroEl || !portraitEl) {
        return { centerX: w * 0.28, centerY: 0, scale: Math.min(w, h) * 0.4 }
      }
      const heroRect = heroEl.getBoundingClientRect()
      const pRect = portraitEl.getBoundingClientRect()

      const centerX = (pRect.left + pRect.width / 2) - (heroRect.left + heroRect.width / 2)
      const centerY = (heroRect.top + heroRect.height / 2) - (pRect.top + pRect.height / 2)
      const scale = Math.min(pRect.width, pRect.height) * 0.98

      return { centerX, centerY, scale }
    }

    function resize() {
      const width = canvasWrap.clientWidth || heroEl.clientWidth || window.innerWidth
      const height = canvasWrap.clientHeight || heroEl.clientHeight || window.innerHeight
      if (!width || !height || !threeHolder.renderer || !threeHolder.camera || !arrays.normHeyX) return

      threeHolder.renderer.setSize(width, height, false)
      threeHolder.camera.left = -width / 2
      threeHolder.camera.right = width / 2
      threeHolder.camera.top = height / 2
      threeHolder.camera.bottom = -height / 2
      threeHolder.camera.updateProjectionMatrix()

      const fsHey = getHeyFontSize(width, height)
      const fsshoyab = getshoyabFontSize(width, height)
      const { centerX, centerY, scale } = getPortraitTransform(width, height)

      for (let i = 0; i < particleCount; i += 1) {
        arrays.homeHeyX[i] = arrays.normHeyX[i] * fsHey
        arrays.homeHeyY[i] = arrays.normHeyY[i] * fsHey

        arrays.homeshoyabX[i] = arrays.normshoyabX[i] * fsshoyab
        arrays.homeshoyabY[i] = arrays.normshoyabY[i] * fsshoyab

        arrays.homePortraitX[i] = centerX + arrays.normPortraitX[i] * scale
        arrays.homePortraitY[i] = centerY + arrays.normPortraitY[i] * scale
      }
    }

    function animate() {
      animIdHolder.current = window.requestAnimationFrame(animate)
      if (!threeHolder.pointsMesh) return

      const now = performance.now()
      const dt = Math.min((now - timeHolder.lastFrame) / 1000, 0.033)
      timeHolder.lastFrame = now
      const step = dt * 60
      const time = now / 1000

      let targetX = arrays.homeHeyX
      let targetY = arrays.homeHeyY
      if (animState.stage === 'shoyab') {
        targetX = arrays.homeshoyabX
        targetY = arrays.homeshoyabY
      } else if (animState.stage === 'portrait') {
        targetX = arrays.homePortraitX
        targetY = arrays.homePortraitY
      }

      const wobble = JIGGLE_AMOUNT * animState.wobble
      const isPortrait = animState.stage === 'portrait'
      // Gentle jiggle for portrait formation vs standard wobble for text
      const baseWobble = isPortrait
        ? JIGGLE_AMOUNT * 0.42 * animState.wobble
        : wobble
      const stageSpring = isPortrait ? 0.024 : SPRING_STRENGTH
      const baseDamping = isPortrait ? 0.88 : DAMPING

      const {
        physicsX,
        physicsY,
        velocityX,
        velocityY,
        phase,
        positions,
        speedCap,
      } = arrays

      const slowRadius = isPortrait ? 150 : 130
      const slowRadiusSq = slowRadius * slowRadius

      for (let i = 0; i < particleCount; i += 1) {
        const desiredX = targetX[i]
        const desiredY = targetY[i]

        const dx = desiredX - physicsX[i]
        const dy = desiredY - physicsY[i]
        const distSq = dx * dx + dy * dy

        let currentDamping = baseDamping
        let currentWobble = baseWobble

        // Smoothly decrease speed as particles get closer to their targets
        if (distSq < slowRadiusSq) {
          const dist = Math.sqrt(distSq)
          const proximity = dist / slowRadius // 1 at boundary, 0 at target

          // Increase braking as distance drops
          currentDamping = 0.52 + 0.26 * proximity

          // Throttle maximum speed proportionally to distance
          const maxSpeed = isPortrait && speedCap
            ? Math.max(0.7, speedCap[i] * proximity)
            : Math.max(1.0, 16 * proximity)

          const currentSpeedSq = velocityX[i] * velocityX[i] + velocityY[i] * velocityY[i]
          if (currentSpeedSq > maxSpeed * maxSpeed) {
            const currentSpeed = Math.sqrt(currentSpeedSq)
            velocityX[i] = (velocityX[i] / currentSpeed) * maxSpeed
            velocityY[i] = (velocityY[i] / currentSpeed) * maxSpeed
          }

          if (currentWobble > 0.02) {
            currentWobble *= Math.max(0.2, proximity)
          }
        } else if (isPortrait && speedCap) {
          // Far away during portrait stage: cruise at synchronized speed cap
          const cruiseMax = speedCap[i]
          const currentSpeedSq = velocityX[i] * velocityX[i] + velocityY[i] * velocityY[i]
          if (currentSpeedSq > cruiseMax * cruiseMax) {
            const currentSpeed = Math.sqrt(currentSpeedSq)
            velocityX[i] = (velocityX[i] / currentSpeed) * cruiseMax
            velocityY[i] = (velocityY[i] / currentSpeed) * cruiseMax
          }
        }

        velocityX[i] += dx * stageSpring * step
        velocityY[i] += dy * stageSpring * step
        velocityX[i] *= currentDamping
        velocityY[i] *= currentDamping
        physicsX[i] += velocityX[i]
        physicsY[i] += velocityY[i]

        if (currentWobble > 0.02) {
          positions[i * 3] = physicsX[i] + Math.sin(time * 11 + phase[i]) * currentWobble
          positions[i * 3 + 1] = physicsY[i] + Math.cos(time * 9 + phase[i] * 1.3) * currentWobble
        } else {
          // Settled shimmer
          const shimmer = Math.sin(time * 2.2 + phase[i]) * SHIMMER
          positions[i * 3] = physicsX[i] + shimmer
          positions[i * 3 + 1] = physicsY[i] + Math.cos(time * 1.7 + phase[i]) * shimmer
        }
      }

      if (threeHolder.material) {
        threeHolder.material.opacity = animState.particleOpacity
      }

      threeHolder.geometry.attributes.position.needsUpdate = true
      threeHolder.renderer.render(threeHolder.scene, threeHolder.camera)
    }

    function start() {
      if (isDisposed.current) return

      const width = canvasWrap.clientWidth || heroEl.clientWidth || window.innerWidth
      const height = canvasWrap.clientHeight || heroEl.clientHeight || window.innerHeight

      const heySample = sampleTextPoints('Hey!', width, height, particleCount, 'large')
      const shoyabSample = sampleTextPoints('I am Mohd Shoyab', width, height, particleCount, 'medium')
      const portraitSample = Array.isArray(portraitPoints) ? portraitPoints : portraitPoints.points

      if (isDisposed.current) return

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x000000, 0)
      canvasWrap.appendChild(renderer.domElement)
      threeHolder.renderer = renderer

      const scene = new THREE.Scene()
      threeHolder.scene = scene

      const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, -10, 10)
      camera.position.z = 1
      threeHolder.camera = camera

      const positions = new Float32Array(particleCount * 3)
      arrays.positions = positions
      arrays.physicsX = new Float32Array(particleCount)
      arrays.physicsY = new Float32Array(particleCount)
      arrays.velocityX = new Float32Array(particleCount)
      arrays.velocityY = new Float32Array(particleCount)
      arrays.speedCap = new Float32Array(particleCount)

      arrays.homeHeyX = new Float32Array(particleCount)
      arrays.homeHeyY = new Float32Array(particleCount)
      arrays.normHeyX = new Float32Array(particleCount)
      arrays.normHeyY = new Float32Array(particleCount)

      arrays.homeshoyabX = new Float32Array(particleCount)
      arrays.homeshoyabY = new Float32Array(particleCount)
      arrays.normshoyabX = new Float32Array(particleCount)
      arrays.normshoyabY = new Float32Array(particleCount)

      arrays.homePortraitX = new Float32Array(particleCount)
      arrays.homePortraitY = new Float32Array(particleCount)
      arrays.normPortraitX = new Float32Array(particleCount)
      arrays.normPortraitY = new Float32Array(particleCount)

      arrays.phase = new Float32Array(particleCount)

      const { centerX, centerY, scale } = getPortraitTransform(width, height)

      for (let i = 0; i < particleCount; i += 1) {
        const pt1 = heySample.points[i] || { x: 0, y: 0 }
        arrays.homeHeyX[i] = pt1.x
        arrays.homeHeyY[i] = pt1.y
        arrays.normHeyX[i] = pt1.x / heySample.fontSize
        arrays.normHeyY[i] = pt1.y / heySample.fontSize

        const pt2 = shoyabSample.points[i] || { x: 0, y: 0 }
        arrays.homeshoyabX[i] = pt2.x
        arrays.homeshoyabY[i] = pt2.y
        arrays.normshoyabX[i] = pt2.x / shoyabSample.fontSize
        arrays.normshoyabY[i] = pt2.y / shoyabSample.fontSize

        const ptP = portraitSample[i] || { x: 0, y: 0 }
        arrays.normPortraitX[i] = ptP.x
        arrays.normPortraitY[i] = ptP.y
        arrays.homePortraitX[i] = centerX + ptP.x * scale
        arrays.homePortraitY[i] = centerY + ptP.y * scale

        // Initial scatter positions
        arrays.physicsX[i] = (Math.random() - 0.5) * width * 1.5
        arrays.physicsY[i] = (Math.random() - 0.5) * height * 1.5
        arrays.phase[i] = Math.random() * Math.PI * 2

        positions[i * 3] = arrays.physicsX[i]
        positions[i * 3 + 1] = arrays.physicsY[i]
        positions[i * 3 + 2] = 0
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      threeHolder.geometry = geometry

      const texture = createDotTexture()
      threeHolder.texture = texture

      const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: dotSize,
        map: texture,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: false,
      })
      threeHolder.material = material

      const pointsMesh = new THREE.Points(geometry, material)
      threeHolder.pointsMesh = pointsMesh
      scene.add(pointsMesh)

      resize()
      animate()

      // Master GSAP Timeline: Hey! → I am Mohd Shoyab → hero page with description → my avatar
      const heroTextElements = [h1Ref.current, descRef.current, actionsRef.current].filter(Boolean)
      gsap.set(heroTextElements, { opacity: 0, y: 24 })

      const tl = gsap.timeline({
        onComplete: () => {
          setSequenceComplete(true)
          if (arrays.homePortraitX && arrays.physicsX) {
            animState.stage = 'portrait'
            animState.wobble = 0
            animState.particleOpacity = 1
            for (let i = 0; i < particleCount; i += 1) {
              arrays.physicsX[i] = arrays.homePortraitX[i]
              arrays.physicsY[i] = arrays.homePortraitY[i]
              arrays.velocityX[i] = 0
              arrays.velocityY[i] = 0
            }
          }
        },
      })
      timelineRef.current = tl

      // STEP 1: Hey! (Spring & jiggle into 'Hey!', then hold)
      tl.addLabel('hey')
      tl.fromTo(
        animState,
        { wobble: 1, particleOpacity: 1 },
        {
          wobble: 0,
          duration: HEY_FORM_DURATION,
          ease: 'power2.out',
          onStart: () => {
            animState.stage = 'hey'
            animState.particleOpacity = 1
          },
        }
      )
      tl.to({}, { duration: HEY_HOLD_DURATION }) // Hold after 'Hey'

      // STEP 2: I am Mohd Shoyab (Scatter burst, spring & jiggle into 'I am Mohd Shoyab', then hold)
      tl.addLabel('shoyab')
      tl.fromTo(
        animState,
        { wobble: 1 },
        {
          wobble: 0,
          duration: SHOYAB_FORM_DURATION,
          ease: 'power2.out',
          onStart: () => {
            triggerScatter()
            animState.stage = 'shoyab'
          },
        }
      )
      tl.to({}, { duration: SHOYAB_HOLD_DURATION }) // Hold after 'I am Mohd Shoyab'

      // STEP 3: 'I am Mohd Shoyab' particles fully disappear (scatter away & fade out) before hero heading and description fade in
      tl.addLabel('disappear')
      tl.to(animState, {
        particleOpacity: 0,
        duration: PARTICLES_FADE_OUT_DURATION,
        ease: 'power2.inOut',
        onStart: () => {
          triggerScatter(340, 480)
        },
      })
      tl.to({}, { duration: PAUSE_BEFORE_HERO_TEXT }) // Clean break before hero text

      // STEP 4: Hero page shows ONLY heading and description (and buttons), with NO portrait
      tl.addLabel('heroPageOnly')
      tl.fromTo(
        heroTextElements,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: HERO_TEXT_FADE_DURATION,
          stagger: HERO_TEXT_STAGGER,
          ease: 'power2.out',
        }
      )
      tl.to({}, { duration: PAUSE_BEFORE_PORTRAIT }) // Pause before portrait forms

      // STEP 5: Then the Avatar appears (particles spawn at screen edges & spring/jiggle inward into portrait)
      tl.addLabel('avatar')
      tl.fromTo(
        animState,
        { wobble: 1, particleOpacity: 1 },
        {
          wobble: 0,
          particleOpacity: 1,
          duration: PORTRAIT_SETTLE_DURATION,
          ease: 'power2.out',
          onStart: () => {
            spawnAroundScreenEdges()
            animState.stage = 'portrait'
            animState.particleOpacity = 1
          },
        }
      )

      // Respect reduced motion
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        tl.progress(1)
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        if (timelineRef.current) {
          timelineRef.current.progress(1)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', resize)

    const observer = new ResizeObserver(resize)
    observer.observe(heroEl)

    start()

    return () => {
      isDisposed.current = true
      if (timelineRef.current) {
        timelineRef.current.kill()
      }
      window.cancelAnimationFrame(animIdHolder.current)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', resize)
      observer.disconnect()
      if (threeHolder.pointsMesh) threeHolder.scene?.remove(threeHolder.pointsMesh)
      threeHolder.geometry?.dispose()
      threeHolder.material?.dispose()
      threeHolder.texture?.dispose()
      threeHolder.renderer?.dispose()
      threeHolder.renderer?.domElement?.remove()
    }
  }, [])

  function handleSkip() {
    if (timelineRef.current) {
      timelineRef.current.progress(1)
    }
  }

  return (
    <section id="hero" className="hero" ref={heroRef}>
      <div className="hero-copy" ref={copyRef}>
        <h1 ref={h1Ref}>Hey! I’m Mohd Shoyab</h1>
        <p className="hero-description" ref={descRef}>
          Mechanical Engineering student at NIT Calicut, bridging core engineering with modern software. From training computer vision models and automating workflows to building web applications.
        </p>
        <div className="hero-actions" ref={actionsRef}>
          <div className="contact-menu" ref={menuRef}>
            <button
              type="button"
              className="btn btn-accent"
              aria-expanded={open}
              aria-haspopup="menu"
              onClick={() => setOpen((value) => !value)}
            >
              Contact me
            </button>
            {open ? (
              <div className="dropdown" role="menu">
                <a role="menuitem" href={`mailto:${contact.email}`}>
                  Email
                </a>
                <a
                  role="menuitem"
                  href={contact.linkedin}
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn
                </a>
                <a
                  role="menuitem"
                  href={contact.github}
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
              </div>
            ) : null}
          </div>
          <a className="btn btn-outline" href="/resume.pdf" download="Mohd-Shoyab-Resume.pdf">
            Resume
          </a>
        </div>
      </div>

      <div
        ref={portraitPlaceholderRef}
        className="hero-portrait particle-portrait-placeholder"
        role="img"
        aria-label="Particle portrait of Mohd Shoyab"
      />

      <div ref={canvasWrapRef} className="hero-canvas-wrap" />

      {!sequenceComplete && (
        <button
          type="button"
          className="intro-skip-btn"
          onClick={handleSkip}
          aria-label="Skip intro animation"
        >
          Skip ✕
        </button>
      )}
    </section>
  )
}

export default Hero
