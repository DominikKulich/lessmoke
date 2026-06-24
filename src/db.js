import Dexie from 'dexie'

export const db = new Dexie('CigTracker')

db.version(1).stores({
  // ++id = auto-increment, ts = timestamp (indexovaný pro řazení/filtr)
  cigarettes: '++id, ts',
  settings: 'key'
})

const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime() }

// Výchozí nastavení
const DEFAULT_SETTINGS = {
  cigsPerPack: 20,
  pricePerPack: 180,
  reminderMinutes: 60,
  remindersOn: true,      // defaultně zapnuté (systémové povolení si appka vyžádá)
  bestStreakMs: 0,        // rekord nejdelší pauzy mezi cigaretami (ms)
  lastSummaryDay: null,   // YYYY-MM-DD posledního zobrazeného denního popupu
  dailyGoal: 0,           // denní limit cigaret (0 = vypnuto)
  weeklyGoal: 0,          // týdenní limit cigaret (0 = vypnuto)
  theme: 'dark',          // 'dark' nebo 'light'
  baselinePerDay: 0       // kolik cigaret denně jsem kouřil dřív (pro výpočet ušetřeno)
}

export async function getSettings() {
  const rows = await db.settings.toArray()
  const obj = { ...DEFAULT_SETTINGS }
  rows.forEach(r => { obj[r.key] = r.value })
  return obj
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value })
}

export async function addCigarette(note = '') {
  return db.cigarettes.add({ ts: Date.now(), note })
}

// přidání cigarety se zadaným časem (ruční zpětný zápis)
export async function addCigaretteAt(ts, note = '') {
  return db.cigarettes.add({ ts, note })
}

// úprava existujícího záznamu (čas a/nebo poznámka)
export async function updateCigarette(id, changes) {
  return db.cigarettes.update(id, changes)
}

export async function deleteCigarette(id) {
  return db.cigarettes.delete(id)
}

// dnešní záznamy seřazené od nejnovějšího
export async function getTodayCigarettes() {
  const from = startOfDay(Date.now())
  const rows = await db.cigarettes.where('ts').aboveOrEqual(from).toArray()
  return rows.sort((a, b) => b.ts - a.ts)
}

export async function getAllCigarettes() {
  return db.cigarettes.orderBy('ts').toArray()
}

export async function getLastCigarette() {
  return db.cigarettes.orderBy('ts').last()
}

// ---- resety ----

// Smaže záznamy z dnešního dne
export async function resetToday() {
  const from = startOfDay(Date.now())
  return db.cigarettes.where('ts').aboveOrEqual(from).delete()
}

// Smaže záznamy za posledních 7 dní
export async function resetWeek() {
  const from = Date.now() - 7*24*3600*1000
  return db.cigarettes.where('ts').aboveOrEqual(from).delete()
}

// Kompletní reset: smaže všechny cigarety i rekord
export async function resetAll() {
  await db.cigarettes.clear()
  await setSetting('bestStreakMs', 0)
}

// ---- záloha / obnova ----
// Export všech dat do objektu (cigarety + nastavení)
export async function exportData() {
  const cigarettes = await db.cigarettes.toArray()
  const settingsRows = await db.settings.toArray()
  return {
    app: 'CigaretyTracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    cigarettes,
    settings: settingsRows
  }
}

// Import dat ze zálohy. mode 'replace' = přepíše vše, 'merge' = přidá k existujícím
export async function importData(data, mode = 'replace') {
  if (!data || data.app !== 'CigaretyTracker' || !Array.isArray(data.cigarettes)) {
    throw new Error('Neplatný soubor zálohy')
  }
  if (mode === 'replace') {
    await db.cigarettes.clear()
    await db.settings.clear()
  }
  // cigarety vkládáme bez původního id (ať se nepřepíšou existující)
  const cigs = data.cigarettes.map(c => ({ ts: c.ts, note: c.note || '' }))
  await db.cigarettes.bulkAdd(cigs)
  if (Array.isArray(data.settings)) {
    for (const row of data.settings) {
      await db.settings.put(row)
    }
  }
}
