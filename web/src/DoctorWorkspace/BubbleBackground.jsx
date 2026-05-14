import { useMemo } from 'react'

const BUBBLE_TONES = ['blue', 'cyan', 'mint', 'purple']
const BUBBLE_DEPTHS = ['soft', 'medium', 'deep']
const ANCHOR_BUBBLES = [
  { id: 'doctor-bubble-anchor-hero', tone: 'blue', depth: 'focus', size: 320, left: 28, top: 18, duration: 11, delay: -3, driftX: 14, driftY: 34 },
  { id: 'doctor-bubble-anchor-mid', tone: 'cyan', depth: 'focus', size: 230, left: 62, top: 36, duration: 9, delay: -6, driftX: -16, driftY: 28 },
  { id: 'doctor-bubble-anchor-rail', tone: 'mint', depth: 'medium', size: 180, left: 83, top: 16, duration: 10, delay: -4, driftX: 12, driftY: 36 },
  { id: 'doctor-bubble-anchor-bottom', tone: 'purple', depth: 'deep', size: 300, left: 78, top: 72, duration: 12, delay: -8, driftX: -18, driftY: 32 },
  { id: 'doctor-bubble-anchor-left', tone: 'mint', depth: 'soft', size: 170, left: 12, top: 72, duration: 8, delay: -5, driftX: 18, driftY: 26 },
]

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min))
}

function createBubble(index) {
  const sizeBands = [
    [22, 42],
    [62, 126],
    [154, 286],
  ]
  const band = index % 7 === 0 ? sizeBands[2] : index % 3 === 0 ? sizeBands[1] : sizeBands[0]
  const depth = BUBBLE_DEPTHS[index % BUBBLE_DEPTHS.length]

  return {
    id: `doctor-bubble-${index}`,
    tone: BUBBLE_TONES[index % BUBBLE_TONES.length],
    depth,
    size: randomBetween(band[0], band[1]),
    left: randomBetween(-4, 96),
    top: randomBetween(-6, 94),
    duration: randomBetween(7, 12),
    delay: randomBetween(-10, 0),
    driftX: randomBetween(-18, 18),
    driftY: randomBetween(18, 42),
  }
}

export default function BubbleBackground() {
  const bubbles = useMemo(
    () => [...ANCHOR_BUBBLES, ...Array.from({ length: 24 }, (_, index) => createBubble(index))],
    []
  )

  return (
    <div className="doctor-bubble-background bubble-background" aria-hidden="true">
      {bubbles.map((bubble) => (
        <span
          key={bubble.id}
          className={`doctor-bubble bubble doctor-bubble-${bubble.tone} doctor-bubble-${bubble.depth}`}
          style={{
            '--bubble-size': `${bubble.size}px`,
            '--bubble-left': `${bubble.left}%`,
            '--bubble-top': `${bubble.top}%`,
            '--bubble-duration': `${bubble.duration}s`,
            '--bubble-delay': `${bubble.delay}s`,
            '--bubble-drift-x': `${bubble.driftX}px`,
            '--bubble-drift-y': `${bubble.driftY}px`,
          }}
        />
      ))}
    </div>
  )
}
