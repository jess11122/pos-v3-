// Lightweight canvas confetti — no library needed
export function launchConfetti(duration = 3000) {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  const COLOURS = ['#d97706','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#f97316','#ffffff']
  const particles = Array.from({ length: 180 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    w: Math.random() * 10 + 4,
    h: Math.random() * 6 + 2,
    colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    vx: (Math.random() - 0.5) * 3,
    vy: Math.random() * 4 + 2,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.2,
  }))

  const end = Date.now() + duration
  let raf

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const p of particles) {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.angle)
      ctx.fillStyle = p.colour
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
      p.x += p.vx
      p.y += p.vy
      p.angle += p.spin
      p.vy += 0.05
      if (p.y > canvas.height + 20) {
        p.y = -20
        p.x = Math.random() * canvas.width
      }
    }
    if (Date.now() < end) {
      raf = requestAnimationFrame(draw)
    } else {
      canvas.remove()
    }
  }
  draw()
  return () => { cancelAnimationFrame(raf); canvas.remove() }
}
