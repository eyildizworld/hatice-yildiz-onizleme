/* Menü, çerez onayı, yorumlar ve 3D sahnenin geç yüklenmesi. Satır içi script yok: CSP buna göre sıkı. */
(() => {
  'use strict'
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const body = document.body

  // Mobil menü
  const menuBtn = $('.hy-menu-btn')
  const nav = $('#hy-nav')
  if (menuBtn && nav) {
    const setOpen = (open) => {
      menuBtn.setAttribute('aria-expanded', String(open))
      nav.classList.toggle('is-open', open)
      body.classList.toggle('hy-menu-open', open)
    }
    menuBtn.addEventListener('click', () => setOpen(menuBtn.getAttribute('aria-expanded') !== 'true'))
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); menuBtn.focus() }
    })
  }

  // Çerez onayı: gerekli olmayan hiçbir şey seçim yapılmadan yüklenmez.
  const KEY = 'hy-consent-v1'
  const SIX_MONTHS = 1000 * 60 * 60 * 24 * 182
  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY))
      return v && Date.now() - v.at < SIX_MONTHS ? v : null
    } catch { return null }
  }
  const write = (v) => {
    try { localStorage.setItem(KEY, JSON.stringify({ ...v, at: Date.now() })) } catch { /* depolama kapalıysa onay yalnızca bu sayfa için geçerli */ }
  }
  const addScript = (src) => {
    const el = document.createElement('script')
    el.src = src
    el.async = true
    document.head.append(el)
  }

  let gaOn = false
  const startAnalytics = () => {
    if (gaOn || !body.dataset.ga) return
    gaOn = true
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() { window.dataLayer.push(arguments) }
    window.gtag('js', new Date())
    window.gtag('config', body.dataset.ga, { anonymize_ip: true })
    addScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(body.dataset.ga))
  }

  let pixelOn = false
  const startPixel = () => {
    if (pixelOn || !body.dataset.pixel) return
    pixelOn = true
    const fbq = function fbq() { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments) }
    fbq.push = fbq
    fbq.loaded = true
    fbq.version = '2.0'
    fbq.queue = []
    window.fbq = window._fbq = fbq
    fbq('init', body.dataset.pixel)
    fbq('track', 'PageView')
    addScript('https://connect.facebook.net/en_US/fbevents.js')
  }
  document.addEventListener('click', (e) => {
    if (pixelOn && e.target.closest('[data-contact]')) window.fbq('track', 'Contact')
  })

  const showReviews = () => {
    for (const box of $$('[data-hy-reviews]')) {
      const tpl = $('template', box)
      if (!tpl) continue
      const content = tpl.content.cloneNode(true)
      // Eklentinin satır içi yedek betiği CSP'ye takılır; yükleyiciyi aşağıda biz ekliyoruz.
      for (const s of $$('script:not([type="application/ld+json"])', content)) s.remove()
      box.prepend(content)
      tpl.remove()
      if (box.dataset.loader) addScript(box.dataset.loader)
      $('[data-hy-reviews-show]', box)?.remove()
      $('.hy-note', box)?.remove()
    }
  }

  const apply = (c) => {
    if (c.analytics) startAnalytics()
    if (c.marketing) startPixel()
    if (c.external) showReviews()
  }

  // Onay geri alınınca izleme çerezleri silinir; yüklenmiş betikler ancak sayfa yenilenince durur.
  const clearTracking = () => {
    const host = location.hostname.replace(/^www\./, '')
    for (const part of document.cookie.split(';')) {
      const name = part.split('=')[0].trim()
      if (/^(_ga|_gid|_gat|_fbp|_fbc)/.test(name)) {
        for (const domain of ['', `; domain=${host}`, `; domain=.${host}`]) {
          document.cookie = `${name}=; Max-Age=0; path=/${domain}`
        }
      }
    }
  }

  const box = $('[data-hy-consent]')
  if (box) {
    const prefs = $('[data-hy-consent-prefs]', box)
    const open = () => {
      const c = read() || {}
      for (const name of ['analytics', 'marketing', 'external']) prefs.elements[name].checked = !!c[name]
      box.hidden = false
    }
    const save = (c) => {
      const before = read()
      const revoked = before && ((before.analytics && !c.analytics) || (before.marketing && !c.marketing) || (before.external && !c.external))
      write(c)
      box.hidden = true
      prefs.hidden = true
      if (revoked) {
        clearTracking()
        location.reload()
        return
      }
      apply(c)
    }
    $('[data-hy-consent-all]', box).addEventListener('click', () => save({ analytics: true, marketing: true, external: true }))
    $('[data-hy-consent-none]', box).addEventListener('click', () => save({ analytics: false, marketing: false, external: false }))
    $('[data-hy-consent-custom]', box).addEventListener('click', () => { prefs.hidden = !prefs.hidden })
    prefs.addEventListener('submit', (e) => {
      e.preventDefault()
      save({ analytics: prefs.elements.analytics.checked, marketing: prefs.elements.marketing.checked, external: prefs.elements.external.checked })
    })
    for (const btn of $$('[data-hy-consent-open]')) btn.addEventListener('click', open)

    const saved = read()
    if (saved) apply(saved)
    else box.hidden = false
  }

  // Yorumlar: düğmeye basmak o an için harici içerik onayıdır ve kalıcı kaydedilir.
  for (const btn of $$('[data-hy-reviews-show]')) {
    btn.addEventListener('click', () => {
      write({ ...(read() || {}), external: true })
      if (box) box.hidden = true
      showReviews()
    })
  }

  // Sahnedeki renk arka plan ışığına da yansır
  const glowTargets = $$('.hy-service')
  if (glowTargets.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) document.documentElement.style.setProperty('--hy-c', e.target.dataset.color)
      }
    }, { rootMargin: '-45% 0px -45% 0px' })
    glowTargets.forEach((el) => io.observe(el))
  }

  // 3D yalnızca ana sayfada, uygun cihazda ve kullanıcı etkileşiminden ya da kısa süre sonra yüklenir.
  const url = body.dataset['3d']
  const stage = $('#hy-stage')
  if (!url || !stage) return
  const canRun3D = () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    const conn = navigator.connection
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return false
    if (navigator.deviceMemory && navigator.deviceMemory < 4) return false
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false
    try { return !!document.createElement('canvas').getContext('webgl2') } catch { return false }
  }
  if (!canRun3D()) return
  document.documentElement.classList.add('hy-3d-on')
  let started = false
  const start = () => {
    if (started) return
    started = true
    const load = () => import(url).then((m) => m.mount(stage)).catch(() => document.documentElement.classList.remove('hy-3d-on'))
    if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 800 })
    else setTimeout(load, 100)
  }
  // Ağır paket ilk açılışı yavaşlatmasın: etkileşimde ya da sayfa bir süre boş kalınca yüklenir. O ana kadar aynı şişenin görseli durur.
  for (const type of ['scroll', 'pointerdown', 'pointermove', 'keydown']) addEventListener(type, start, { once: true, passive: true })
  addEventListener('load', () => setTimeout(start, 8000), { once: true })
})()
