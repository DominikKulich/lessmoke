// Připomínání cigaret přes systémové notifikace telefonu.
// Používá Service Worker (registration.showNotification), což je na Androidu
// správný způsob, jak dostat notifikaci do notifikační lišty - vyjede i když
// máš appku jen na pozadí (dokud ji systém nevyhodí z paměti).

let timerId = null
let targetTime = null

const STORAGE_KEY = 'lessmoke_reminder_target'
const STORAGE_INTERVAL = 'lessmoke_reminder_interval'

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

// Spustí opakovaný odpočet. Po každém uplynutí intervalu vyjede notifikace
// a odpočet se rozjede znovu. onTick(zbyvaMs) se volá každou sekundu (pro UI).
// Pokud je uložený platný cíl z minula (přežil obnovení stránky) a interval se
// nezměnil, pokračuje od něj místo restartu na plný interval.
export function startReminders(minutes, onTick, forceRestart = false) {
  stopReminders(false)
  const intervalMs = minutes * 60 * 1000

  // pokus o navázání na uložený cíl (jen když sedí i interval)
  const saved = Number(localStorage.getItem(STORAGE_KEY))
  const savedInterval = Number(localStorage.getItem(STORAGE_INTERVAL))
  const intervalMatches = savedInterval === minutes
  if (!forceRestart && saved && saved > Date.now() && intervalMatches) {
    targetTime = saved // pokračuj tam, kde jsi přestal
  } else {
    targetTime = Date.now() + intervalMs
    localStorage.setItem(STORAGE_KEY, String(targetTime))
    localStorage.setItem(STORAGE_INTERVAL, String(minutes))
  }

  timerId = setInterval(async () => {
    const remaining = targetTime - Date.now()
    if (onTick) onTick(Math.max(0, remaining))
    if (remaining <= 0) {
      await fireNotification()
      targetTime = Date.now() + intervalMs // další kolo
      localStorage.setItem(STORAGE_KEY, String(targetTime))
    }
  }, 1000)
}

export function stopReminders(clearSaved = true) {
  if (timerId) { clearInterval(timerId); timerId = null }
  targetTime = null
  if (clearSaved) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_INTERVAL)
  }
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