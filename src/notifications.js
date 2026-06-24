// Připomínání cigaret přes systémové notifikace telefonu.
// Používá Service Worker (registration.showNotification), což je na Androidu
// správný způsob, jak dostat notifikaci do notifikační lišty - vyjede i když
// máš appku jen na pozadí (dokud ji systém nevyhodí z paměti).

let timerId = null
let targetTime = null

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

// Spustí opakovaný odpočet. Po každém uplynutí intervalu vyjede notifikace
// a odpočet se rozjede znovu. onTick(zbyvaMs) se volá každou sekundu (pro UI).
export function startReminders(minutes, onTick) {
  stopReminders()
  const intervalMs = minutes * 60 * 1000
  targetTime = Date.now() + intervalMs

  timerId = setInterval(async () => {
    const remaining = targetTime - Date.now()
    if (onTick) onTick(Math.max(0, remaining))
    if (remaining <= 0) {
      await fireNotification()
      targetTime = Date.now() + intervalMs // další kolo
    }
  }, 1000)
}

export function stopReminders() {
  if (timerId) { clearInterval(timerId); timerId = null }
  targetTime = null
}

// Kolik zbývá do další notifikace (ms), nebo null když je odpočet vypnutý
export function remainingMs() {
  return targetTime ? Math.max(0, targetTime - Date.now()) : null
}

async function fireNotification() {
  if (Notification.permission !== 'granted') return
  const options = {
    body: 'Čas na cigaretu podle tvého intervalu.',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: 'cig-reminder',
    renotify: true,
    vibrate: [200, 100, 200],
    requireInteraction: false
  }
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification('Lessmoke', options)
      return
    }
  } catch (e) {
    console.warn('SW notifikace selhala, zkouším fallback', e)
  }
  try { new Notification('Lessmoke', options) }
  catch (e) { console.warn('Notifikaci nelze zobrazit', e) }
}
