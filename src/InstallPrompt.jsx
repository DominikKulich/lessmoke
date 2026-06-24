import { useState, useEffect } from 'react'

// Sdílený stav instalace pro celou appku (lišta i tlačítko v nastavení).
let deferredPromptGlobal = null
const listeners = new Set()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPromptGlobal = e
    listeners.forEach(fn => fn())
  })
  window.addEventListener('appinstalled', () => {
    deferredPromptGlobal = null
    listeners.forEach(fn => fn())
  })
}

function useInstall() {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force(n => n + 1)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])

  const standalone = typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)
  const isIOS = typeof window !== 'undefined' && /iphone|ipad|ipod/i.test(window.navigator.userAgent)

  async function install() {
    if (deferredPromptGlobal) {
      deferredPromptGlobal.prompt()
      await deferredPromptGlobal.userChoice
      deferredPromptGlobal = null
      listeners.forEach(fn => fn())
      return 'prompted'
    }
    // Chrome nabídku neposlal, ale appka může jít nainstalovat ručně
    return isIOS ? 'ios' : 'manual'
  }

  return { canPrompt: !!deferredPromptGlobal, standalone, isIOS, install }
}

// Lišta nahoře na hlavní stránce - jen pro nové (neinstalované) uživatele
export function InstallBar() {
  const { standalone, isIOS, install } = useInstall()
  const [show, setShow] = useState(true)
  const [hint, setHint] = useState('')

  if (standalone) return null // už nainstalováno
  if (!show) return null
  if (localStorage.getItem('lessmoke_install_dismissed') === '1') return null

  async function onAdd() {
    const r = await install()
    if (r === 'manual') setHint('Otevři menu prohlížeče (⋮) a vyber „Přidat na plochu".')
    else if (r === 'ios') setHint('V Safari klepni na „Sdílet" a pak „Přidat na plochu".')
    else setShow(false)
  }
  function onClose() {
    setShow(false)
    localStorage.setItem('lessmoke_install_dismissed', '1')
  }

  return (
    <div className="install-bar">
      <div className="install-text">
        <strong>📲 Přidat Lessmoke na plochu</strong>
        {hint
          ? <span>{hint}</span>
          : <span>Měj appku po ruce jako ikonu a využij notifikace.</span>}
      </div>
      <div className="install-actions">
        {!isIOS && <button className="install-yes" onClick={onAdd}>Přidat</button>}
        <button className="install-no" onClick={onClose}>Teď ne</button>
      </div>
    </div>
  )
}

// Tlačítko do nastavení - vždy dostupné
export function InstallButton() {
  const { standalone, isIOS, install } = useInstall()
  const [hint, setHint] = useState('')

  if (standalone) {
    return <p className="note">✓ Lessmoke je nainstalovaný na ploše.</p>
  }

  async function onAdd() {
    const r = await install()
    if (r === 'manual') setHint('Chrome teď nenabídl automatickou instalaci. Otevři menu prohlížeče (⋮) a vyber „Přidat na plochu" / „Instalovat aplikaci".')
    else if (r === 'ios') setHint('V Safari klepni dole na „Sdílet" a pak „Přidat na plochu".')
    else setHint('')
  }

  return (
    <>
      <button className="reset-btn" onClick={onAdd}>
        📲 Přidat appku na plochu
      </button>
      {hint && <p className="note">{hint}</p>}
    </>
  )
}
