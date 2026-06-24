import { useState, useEffect } from 'react'

// Lišta, která nabídne přidání appky na plochu.
// Na Androidu/Chrome využívá událost beforeinstallprompt (nativní dialog).
// Na iOS (Safari) tato událost neexistuje, proto tam ukáže ruční návod.
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // už nainstalováno (běží ve standalone režimu)? nic nenabízej
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
    if (standalone) return

    // uživatel už lištu zavřel? respektuj to
    if (localStorage.getItem('lessmoke_install_dismissed') === '1') return

    // detekce iOS (Safari nepodporuje beforeinstallprompt)
    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    if (ios) {
      setIsIOS(true)
      setShow(true)
      return
    }

    // Android/Chrome: zachyť nabídku instalace
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setShow(false)
      setDeferredPrompt(null)
    }
  }

  function handleDismiss() {
    setShow(false)
    localStorage.setItem('lessmoke_install_dismissed', '1')
  }

  if (!show) return null

  return (
    <div className="install-bar">
      <div className="install-text">
        <strong>📲 Přidat Lessmoke na plochu</strong>
        {isIOS
          ? <span>V Safari klepni na „Sdílet" a pak „Přidat na plochu".</span>
          : <span>Měj appku po ruce jako ikonu a využij notifikace.</span>}
      </div>
      <div className="install-actions">
        {!isIOS && (
          <button className="install-yes" onClick={handleInstall}>Přidat</button>
        )}
        <button className="install-no" onClick={handleDismiss}>Teď ne</button>
      </div>
    </div>
  )
}
