import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getSettings, setSetting, addCigarette, deleteCigarette,
  getAllCigarettes, getLastCigarette,
  resetToday, resetWeek, resetAll,
  addCigaretteAt, updateCigarette, getTodayCigarettes,
  exportData, importData
} from './db'
import { requestPermission, startReminders, stopReminders, remainingMs } from './notifications'
import { tipAt, TIPS } from './tips'
import { HEALTH_MILESTONES, milestoneStatus } from './milestones'
import InstallPrompt from './InstallPrompt'
import Onboarding from './Onboarding'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Legend, Cell,
  Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

// ---- pomocné funkce ----
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime() }
const dayLabel = (ts) => new Date(ts).toLocaleDateString('cs-CZ', { day:'numeric', month:'numeric' })

function formatDuration(ms) {
  if (ms < 0) ms = 0
  const s = Math.floor(ms/1000)
  const h = Math.floor(s/3600)
  const m = Math.floor((s%3600)/60)
  const sec = s%60
  return `${h}h ${m}m ${sec}s`
}

function formatCountdown(ms) {
  if (ms < 0) ms = 0
  const s = Math.floor(ms/1000)
  const m = Math.floor(s/60)
  const sec = s%60
  return `${m}:${String(sec).padStart(2,'0')}`
}

// kratší formát pauzy (bez sekund) pro rekord a popup
function formatStreak(ms) {
  if (ms < 0) ms = 0
  const s = Math.floor(ms/1000)
  const d = Math.floor(s/86400)
  const h = Math.floor((s%86400)/3600)
  const m = Math.floor((s%3600)/60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const dayKey = (ts) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function App() {
  const [cigs, setCigs] = useState([])
  const [settings, setSettings] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [tab, setTab] = useState('home')
  const [countdown, setCountdown] = useState(null) // ms do další notifikace
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length))
  const [dailyPopup, setDailyPopup] = useState(null) // data shrnutí včerejška
  const [guideOpen, setGuideOpen] = useState(false)
  const [noteModal, setNoteModal] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [todayLog, setTodayLog] = useState([])
  const [editing, setEditing] = useState(null) // {id, time, note} právě editovaný záznam

  const reload = useCallback(async () => {
    setCigs(await getAllCigarettes())
    setTodayLog(await getTodayCigarettes())
  }, [])

  useEffect(() => {
    (async () => {
      setSettings(await getSettings())
      await reload()
    })()
  }, [reload])

  // aplikace tématu (světlý/tmavý) na body
  useEffect(() => {
    if (!settings) return
    document.body.setAttribute('data-theme', settings.theme || 'dark')
  }, [settings])

  // při startu: pokud jsou připomínky zapnuté, vyžádej systémové povolení.
  // Když ho uživatel nedá, připomínky se tiše vypnou (zůstanou statistiky atd.)
  useEffect(() => {
    if (!settings || !settings.remindersOn) return
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') return
    (async () => {
      const perm = await requestPermission()
      if (perm !== 'granted') {
        await setSetting('remindersOn', false)
        setSettings(s => ({ ...s, remindersOn: false }))
      }
    })()
    // spustit jen jednou po načtení nastavení
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings !== null])

  // tikající stopky
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // řízení notifikací - reaguje JEN na zapnutí/vypnutí a změnu intervalu,
  // ne na ostatní nastavení (téma, cena...), aby se odpočet zbytečně nerestartoval
  useEffect(() => {
    if (!settings) return
    if (settings.remindersOn) {
      // naváže na uložený cíl (přežije obnovení stránky), jinak začne nový interval
      startReminders(settings.reminderMinutes, (ms) => setCountdown(ms))
    } else {
      stopReminders() // vypnuto = zastavit i smazat uložený cíl
      setCountdown(null)
    }
    // cleanup jen zastaví časovač, uložený cíl nechá být (kvůli obnovení stránky)
    return () => stopReminders(false)
  }, [settings?.remindersOn, settings?.reminderMinutes])

  // automatická rotace tipů každých 12 sekund
  useEffect(() => {
    const t = setInterval(() => setTipIndex(i => i + 1), 12000)
    return () => clearInterval(t)
  }, [])

  // denní popup: jednou za den ukáže shrnutí včerejška
  useEffect(() => {
    if (!settings || !cigs) return
    const today = dayKey(Date.now())
    if (settings.lastSummaryDay === today) return // dnes už zobrazeno

    // spočítej včerejšek
    const yStart = startOfDay(Date.now() - 24*3600*1000)
    const yEnd = startOfDay(Date.now())
    const yCigs = cigs.filter(c => c.ts >= yStart && c.ts < yEnd)
    // popup ukážeme jen pokud existují nějaká data (aspoň jeden den používání)
    if (cigs.length === 0) return

    const count = yCigs.length
    const cost = Math.floor(count / settings.cigsPerPack) * settings.pricePerPack

    // nejdelší pauza mezi cigaretami POUZE v rámci včerejška
    // (nebereme mezeru přes noc od předevčírejška)
    let maxGap = 0
    const yTimes = cigs.map(c => c.ts).filter(t => t >= yStart && t < yEnd).sort((a,b)=>a-b)
    for (let i = 1; i < yTimes.length; i++) {
      const gap = yTimes[i] - yTimes[i-1]
      if (gap > maxGap) maxGap = gap
    }

    setDailyPopup({ count, cost, maxGap, date: yStart })
    setSetting('lastSummaryDay', today)
    setSettings(s => ({ ...s, lastSummaryDay: today }))
  }, [settings, cigs])

  const last = cigs.length ? cigs[cigs.length - 1] : null

  // ---- výpočty ----
  // Peníze se počítají po CELÝCH krabičkách: útrata naskočí o cenu krabičky
  // až po dokouření celých 20 ks. 19 cigaret = 0 Kč, 20 = 180 Kč, 21 = 180 Kč...
  const stats = useMemo(() => {
    if (!settings) return null
    const total = cigs.length
    const totalCost = Math.floor(total / settings.cigsPerPack) * settings.pricePerPack

    const todayStart = startOfDay(Date.now())
    const today = cigs.filter(c => c.ts >= todayStart).length
    const todayCost = Math.floor(today / settings.cigsPerPack) * settings.pricePerPack

    const weekAgo = Date.now() - 7*24*3600*1000
    const week = cigs.filter(c => c.ts >= weekAgo).length
    const weekCost = Math.floor(week / settings.cigsPerPack) * settings.pricePerPack

    const monthAgo = Date.now() - 30*24*3600*1000
    const month = cigs.filter(c => c.ts >= monthAgo).length
    const monthCost = Math.floor(month / settings.cigsPerPack) * settings.pricePerPack

    return { total, totalCost, today, todayCost, week, weekCost, month, monthCost }
  }, [cigs, settings])

  // statistika ušetřeno: kolik bych utratil při původní spotřebě mínus skutečnost
  const savings = useMemo(() => {
    if (!settings || !stats || !settings.baselinePerDay) return null
    const pricePerCig = settings.pricePerPack / settings.cigsPerPack
    const calc = (actualCount, days) => {
      const wouldSmoke = settings.baselinePerDay * days
      const saved = Math.max(0, wouldSmoke - actualCount)
      return Math.round(saved * pricePerCig)
    }
    // počet dní používání (od první cigarety), max 30 pro měsíc
    const firstTs = cigs.length ? cigs[0].ts : Date.now()
    const daysUsed = Math.max(1, Math.ceil((Date.now() - firstTs) / (24*3600*1000)))
    return {
      week: calc(stats.week, Math.min(7, daysUsed)),
      month: calc(stats.month, Math.min(30, daysUsed)),
      total: calc(stats.total, daysUsed),
      fewerToday: Math.max(0, settings.baselinePerDay - stats.today)
    }
  }, [cigs, settings, stats])

  // data pro graf: posledních 14 dní
  const chartData = useMemo(() => {
    if (!settings) return []
    const days = []
    for (let i = 13; i >= 0; i--) {
      const dayStart = startOfDay(Date.now() - i*24*3600*1000)
      const dayEnd = dayStart + 24*3600*1000
      const count = cigs.filter(c => c.ts >= dayStart && c.ts < dayEnd).length
      days.push({
        den: dayLabel(dayStart),
        cigarety: count,
        // výdaj za den = jen za CELÉ dokouřené krabičky daný den
        kc: Math.floor(count / settings.cigsPerPack) * settings.pricePerPack
      })
    }
    return days
  }, [cigs, settings])

  // průměr cigaret za den (pro referenční čáru v grafu)
  const avgPerDay = useMemo(() => {
    if (!chartData.length) return 0
    const sum = chartData.reduce((a, d) => a + d.cigarety, 0)
    return Math.round((sum / chartData.length) * 10) / 10
  }, [chartData])

  // aktuální pauza od poslední cigarety
  const currentStreak = last ? (now - last.ts) : 0

  // rekord nejdelší pauzy: větší z uloženého rekordu a aktuální pauzy
  const bestStreak = useMemo(() => {
    if (!settings) return 0
    return Math.max(settings.bestStreakMs || 0, currentStreak)
  }, [settings, currentStreak])

  // uložení rekordu, když ho aktuální pauza překoná
  useEffect(() => {
    if (!settings || !last) return
    if (currentStreak > (settings.bestStreakMs || 0)) {
      setSetting('bestStreakMs', currentStreak)
      setSettings(s => ({ ...s, bestStreakMs: currentStreak }))
    }
  }, [currentStreak, settings, last])

  // zdravotní milník podle aktuální pauzy
  const milestone = useMemo(() => milestoneStatus(currentStreak), [currentStreak])

  // statistika podle hodin (kdy nejčastěji kouřím) - za posledních 30 dní
  const hourlyData = useMemo(() => {
    const hours = new Array(24).fill(0)
    const from = Date.now() - 30*24*3600*1000
    cigs.forEach(c => {
      if (c.ts >= from) hours[new Date(c.ts).getHours()]++
    })
    return hours
  }, [cigs])
  const maxHour = useMemo(() => Math.max(1, ...hourlyData), [hourlyData])

  // heatmapa: posledních 35 dní (5 týdnů × 7 dní)
  const heatData = useMemo(() => {
    const days = []
    for (let i = 34; i >= 0; i--) {
      const dayStart = startOfDay(Date.now() - i*24*3600*1000)
      const dayEnd = dayStart + 24*3600*1000
      const count = cigs.filter(c => c.ts >= dayStart && c.ts < dayEnd).length
      days.push({ ts: dayStart, count })
    }
    return days
  }, [cigs])
  const maxHeat = useMemo(() => Math.max(1, ...heatData.map(d => d.count)), [heatData])

  // ---- akce ----
  async function handleSmoke(note = '') {
    if (navigator.vibrate) navigator.vibrate(30) // jemná zpětná vazba
    await addCigarette(note)
    await reload()
    // odpočet do další připomínky běží od poslední cigarety (restart na plný interval)
    if (settings?.remindersOn) {
      startReminders(settings.reminderMinutes, (ms) => setCountdown(ms), true)
    }
  }
  async function handleSmokeWithNote() {
    await handleSmoke(noteText.trim())
    setNoteText('')
    setNoteModal(false)
  }
  async function handleUndo() {
    if (last) { await deleteCigarette(last.id); await reload() }
  }

  // ruční přidání cigarety se zadaným časem (dnešní den)
  async function handleAddManual(timeStr, note) {
    const [h, m] = (timeStr || '').split(':').map(Number)
    const d = new Date()
    d.setHours(isNaN(h) ? d.getHours() : h, isNaN(m) ? 0 : m, 0, 0)
    await addCigaretteAt(d.getTime(), note || '')
    await reload()
  }
  // uložení úpravy existujícího záznamu
  async function handleSaveEdit() {
    if (!editing) return
    const [h, m] = (editing.time || '').split(':').map(Number)
    const orig = new Date(editing.ts)
    orig.setHours(isNaN(h) ? orig.getHours() : h, isNaN(m) ? 0 : m, 0, 0)
    await updateCigarette(editing.id, { ts: orig.getTime(), note: editing.note || '' })
    setEditing(null)
    await reload()
  }
  async function handleDeleteRecord(id) {
    await deleteCigarette(id)
    await reload()
  }
  async function updateSetting(key, value) {
    await setSetting(key, value)
    setSettings(await getSettings())
  }
  async function toggleReminders() {
    if (!settings.remindersOn) {
      const perm = await requestPermission()
      if (perm !== 'granted') {
        alert('Notifikace nejsou povolené. Povol je v nastavení prohlížeče.')
        return
      }
    }
    await updateSetting('remindersOn', !settings.remindersOn)
  }

  async function handleResetToday() {
    if (!confirm('Opravdu smazat všechny dnešní cigarety?')) return
    await resetToday()
    await reload()
  }
  async function handleResetWeek() {
    if (!confirm('Opravdu smazat cigarety za posledních 7 dní?')) return
    await resetWeek()
    await reload()
  }
  async function handleResetAll() {
    if (!confirm('Kompletní reset smaže VŠECHNY záznamy i rekord. Pokračovat?')) return
    await resetAll()
    setSettings(await getSettings())
    await reload()
  }

  // export dat do staženého JSON souboru
  async function handleExport() {
    const data = await exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const today = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `cigarety-zaloha-${today}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // import dat z vybraného souboru
  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const replace = confirm(
        'Nahradit současná data zálohou?\n\nOK = nahradit vše\nZrušit = přidat zálohu ke stávajícím datům'
      )
      await importData(data, replace ? 'replace' : 'merge')
      setSettings(await getSettings())
      await reload()
      alert('Záloha byla úspěšně načtena.')
    } catch (err) {
      alert('Soubor se nepodařilo načíst: ' + err.message)
    } finally {
      e.target.value = '' // umožní vybrat stejný soubor znovu
    }
  }

  if (!settings || !stats) return <div className="loading">Načítám…</div>

  // úvodní průvodce při prvním spuštění
  async function finishOnboarding(values) {
    for (const [key, value] of Object.entries(values)) {
      await setSetting(key, value)
    }
    setSettings(await getSettings())
  }

  // barvy grafů podle tématu (Recharts potřebuje konkrétní hodnoty)
  const light = settings.theme === 'light'
  const cGrid = light ? '#e2e8f0' : '#243352'
  const cAxis = light ? '#64748b' : '#64748b'
  const cBar = light ? '#0284c7' : '#38bdf8'
  const cBarDim = light ? '#7dd3fc' : '#1d6fa5'
  const cLine = light ? '#dc2626' : '#f87171'

  return (
    <div className="app">
      {!settings.onboarded && (
        <Onboarding defaults={settings} onDone={finishOnboarding} />
      )}
      <header>
        <h1>🚬 Lessmoke</h1>
      </header>

      <InstallPrompt />

      {tab === 'home' && (
        <main>
          <div className="timer-card">
            <span className="label">Bez cigarety (aktuálně)</span>
            <span className="timer">
              {last ? formatDuration(now - last.ts) : '—'}
            </span>
            <span className="record">
              🏆 Rekord: {bestStreak > 0 ? formatStreak(bestStreak) : '—'}
            </span>
          </div>

          {settings.remindersOn && countdown != null && (
            <div className="countdown-card">
              <span className="label">⏰ Další připomínka za</span>
              <span className="countdown">{formatCountdown(countdown)}</span>
            </div>
          )}

          {(settings.dailyGoal > 0 || settings.weeklyGoal > 0) && (
            <div className="goal-card">
              {settings.dailyGoal > 0 && (
                <GoalBar label="Denní cíl" count={stats.today} goal={settings.dailyGoal} />
              )}
              {settings.weeklyGoal > 0 && (
                <div style={{ marginTop: settings.dailyGoal > 0 ? 14 : 0 }}>
                  <GoalBar label="Týdenní cíl" count={stats.week} goal={settings.weeklyGoal} />
                </div>
              )}
            </div>
          )}

          {!last ? (
            <div className="milestone-card">
              <div className="ms-head">❤️ Zdraví se zotavuje</div>
              <div className="ms-desc" style={{ marginBottom: 0 }}>
                Jakmile zapíšeš první cigaretu, začneme měřit pauzu a uvidíš tu,
                co se ve tvém těle děje a kdy přijde další zlepšení.
              </div>
            </div>
          ) : milestone.next ? (
            <div className="milestone-card">
              <div className="ms-head">❤️ Zdraví se zotavuje</div>
              {milestone.current && (
                <>
                  <div className="ms-title">✓ {milestone.current.title}</div>
                  <div className="ms-desc">{milestone.current.desc}</div>
                </>
              )}
              <div className="goal-bar" style={{ marginBottom: 10 }}>
                <div className="goal-fill" style={{ width: `${Math.round(milestone.progress*100)}%`, background: 'var(--accent)' }} />
              </div>
              <div className="ms-next">
                Další: <strong>{milestone.next.title}</strong> za {formatStreak(milestone.next.ms - currentStreak)}
              </div>
            </div>
          ) : (
            <div className="milestone-card">
              <div className="ms-head">❤️ Zdraví se zotavuje</div>
              <div className="ms-title">✓ Všechny milníky dosaženy!</div>
              <div className="ms-desc" style={{ marginBottom: 0 }}>
                Skvělá práce — tvoje pauza překonala i ten poslední milník.
              </div>
            </div>
          )}

          <button className="big-btn" onClick={() => handleSmoke()}>
            ✓ Měl jsem cigaretu
          </button>
          <div className="row-btns">
            <button className="undo-btn" onClick={handleUndo} disabled={!last}>
              🗑 Vymazat poslední cigaretu
            </button>
            <button className="note-btn" onClick={() => setNoteModal(true)}>
              ✏️ Ručně zadat
            </button>
          </div>

          <div className="tip-card" onClick={() => setTipIndex(i => i + 1)}>
            <span className="tip-head">💡 Tip, jak přestat</span>
            <span className="tip-text">{tipAt(tipIndex)}</span>
            <span className="tip-hint">Klepni pro další tip</span>
          </div>

          <div className="grid">
            <Stat label="Vykouřeno dnes" value={`${stats.today} ks`} />
            <Stat label="Vykouřeno tento týden" value={`${stats.week} ks`} />
            <Stat label="Vykouřeno celkem" value={`${stats.total} ks`} />
            <Stat label="Utraceno celkem" value={`${stats.totalCost} Kč`} />
          </div>
        </main>
      )}

      {tab === 'graphs' && (
        <main>
          <h2>Cigarety za den</h2>
          <p className="chart-sub">Posledních 14 dní · průměr {avgPerDay} ks/den</p>
          <div className="chart">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cGrid} vertical={false} />
                <XAxis dataKey="den" stroke={cAxis} fontSize={11} tickLine={false} />
                <YAxis stroke={cAxis} fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip content={<CigTooltip />} cursor={{ fill: 'rgba(56,189,248,0.08)' }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="cigarety" name="Cigaret za den" radius={[5,5,0,0]} maxBarSize={26}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.cigarety >= avgPerDay ? cBar : cBarDim} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h2>Výdaje za den</h2>
          <p className="chart-sub">Naskočí o {settings.pricePerPack} Kč za každou dokouřenou krabičku</p>
          <div className="chart">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cGrid} vertical={false} />
                <XAxis dataKey="den" stroke={cAxis} fontSize={11} tickLine={false} />
                <YAxis stroke={cAxis} fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${v}`} />
                <Tooltip content={<MoneyTooltip />} cursor={{ stroke: cLine, strokeDasharray: '3 3' }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Line type="monotone" dataKey="kc" name="Útrata za den (Kč)"
                  stroke={cLine} strokeWidth={2.5} dot={{ r: 3, fill: cLine }}
                  activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <h2>Kalendář (5 týdnů)</h2>
          <p className="chart-sub">Tmavší = víc cigaret ten den</p>
          <div className="heatmap">
            {heatData.map((d, i) => {
              const intensity = d.count === 0 ? 0 : 0.2 + 0.8 * (d.count / maxHeat)
              return (
                <div key={i} className="heat-cell" title={`${dayLabel(d.ts)}: ${d.count} ks`}
                  style={{ background: d.count === 0 ? 'var(--card2)' : `rgba(56,189,248,${intensity})` }}>
                  {d.count > 0 ? d.count : ''}
                </div>
              )
            })}
          </div>
          <div className="heat-legend">
            méně
            <span className="sq" style={{ background: 'var(--card2)' }} />
            <span className="sq" style={{ background: 'rgba(56,189,248,0.4)' }} />
            <span className="sq" style={{ background: 'rgba(56,189,248,0.7)' }} />
            <span className="sq" style={{ background: 'rgba(56,189,248,1)' }} />
            více
          </div>

          <h2 style={{ marginTop: 20 }}>Kdy nejvíc kouřím</h2>
          <p className="chart-sub">Podle hodiny dne · posledních 30 dní</p>
          <div className="hours-chart">
            {hourlyData.map((c, h) => (
              <div key={h} className="hour-bar" title={`${h}:00 — ${c} ks`}>
                <div className="bar" style={{ height: `${(c / maxHour) * 100}%` }} />
                <span className="hl">{h % 6 === 0 ? h : ''}</span>
              </div>
            ))}
          </div>
        </main>
      )}

      {tab === 'report' && (
        <main>
          <h2>Útrata za cigarety</h2>
          <p className="chart-sub">Počítá se jen za celé dokouřené krabičky</p>

          <div className="report-grid">
            <MoneyCard label="Dnes" count={stats.today} cost={stats.todayCost} settings={settings} />
            <MoneyCard label="Tento týden" count={stats.week} cost={stats.weekCost} settings={settings} />
            <MoneyCard label="Tento měsíc" count={stats.month} cost={stats.monthCost} settings={settings} />
            <MoneyCard label="Celkem" count={stats.total} cost={stats.totalCost} settings={settings} />
          </div>

          <p className="note">
            Cena krabičky: {settings.pricePerPack} Kč za {settings.cigsPerPack} ks.
            Útrata naskočí o {settings.pricePerPack} Kč vždy po dokouření celých {settings.cigsPerPack} cigaret.
            Rozkouřená krabička se do útraty zatím nepočítá.
          </p>

          {savings ? (
            <>
              <h2 style={{ marginTop: 24 }}>💰 Ušetřeno omezením</h2>
              <p className="chart-sub">Oproti tvé původní spotřebě {settings.baselinePerDay} ks/den</p>
              <div className="savings-card">
                <span className="savings-big">{savings.total} Kč</span>
                <span className="savings-label">ušetřeno celkem</span>
                <div className="savings-row">
                  <div><strong>{savings.week} Kč</strong><span>tento týden</span></div>
                  <div><strong>{savings.month} Kč</strong><span>tento měsíc</span></div>
                </div>
                {savings.fewerToday > 0 && (
                  <p className="savings-msg">
                    Dnes jsi zatím o {savings.fewerToday} {savings.fewerToday === 1 ? 'cigaretu' : (savings.fewerToday <= 4 ? 'cigarety' : 'cigaret')} pod svým původním průměrem. 👏
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="savings-hint">
              💡 Chceš vidět, kolik šetříš omezením? Nastav v Nastavení svou
              původní denní spotřebu.
            </div>
          )}
        </main>
      )}

      {tab === 'log' && (
        <main>
          <h2>Dnešní záznamy</h2>
          <p className="chart-sub">{todayLog.length} {todayLog.length === 1 ? 'cigareta' : (todayLog.length >= 2 && todayLog.length <= 4 ? 'cigarety' : 'cigaret')} dnes · klepni pro úpravu</p>

          <button className="big-btn" onClick={() => {
            const d = new Date()
            setEditing({ id: null, ts: d.getTime(), time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`, note: '' })
          }}>
            + Přidat cigaretu ručně
          </button>

          {todayLog.length === 0 ? (
            <p className="note" style={{ textAlign: 'center', marginTop: 20 }}>
              Dnes zatím žádný záznam. Přidej ho tlačítkem výše nebo na hlavní stránce.
            </p>
          ) : (
            <div className="log-list">
              {todayLog.map(rec => (
                <div key={rec.id} className="log-item">
                  <div className="log-main" onClick={() => setEditing({
                    id: rec.id, ts: rec.ts,
                    time: `${String(new Date(rec.ts).getHours()).padStart(2,'0')}:${String(new Date(rec.ts).getMinutes()).padStart(2,'0')}`,
                    note: rec.note || ''
                  })}>
                    <span className="log-time">
                      {new Date(rec.ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {rec.note
                      ? <span className="log-note">{rec.note}</span>
                      : <span className="log-note empty">bez poznámky</span>}
                  </div>
                  <button className="log-del" onClick={() => handleDeleteRecord(rec.id)} aria-label="Smazat">
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {tab === 'settings' && (
        <main>
          <h2>Vzhled</h2>
          <div className="seg">
            <button className={settings.theme === 'dark' ? 'on' : ''}
              onClick={() => updateSetting('theme', 'dark')}>🌙 Tmavý</button>
            <button className={settings.theme === 'light' ? 'on' : ''}
              onClick={() => updateSetting('theme', 'light')}>☀️ Světlý</button>
          </div>

          <h2 style={{ marginTop: 24 }}>Cíle</h2>
          <Field label="Denní limit cigaret (0 = vyp)">
            <input type="number" value={settings.dailyGoal}
              onChange={e => updateSetting('dailyGoal', Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label="Týdenní limit cigaret (0 = vyp)">
            <input type="number" value={settings.weeklyGoal}
              onChange={e => updateSetting('weeklyGoal', Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label="Původní spotřeba (ks/den)">
            <input type="number" value={settings.baselinePerDay}
              onChange={e => updateSetting('baselinePerDay', Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <p className="note">
            Když nastavíš limit, na hlavní stránce uvidíš, kolik ti zbývá.
            Po překročení se ukazatel zbarví červeně. Původní spotřeba slouží
            k výpočtu, kolik jsi ušetřil omezením (v záložce Report).
          </p>

          <h2 style={{ marginTop: 24 }}>Nastavení cen a připomínek</h2>
          <Field label="Cigaret v krabičce">
            <input type="number" value={settings.cigsPerPack}
              onChange={e => updateSetting('cigsPerPack', Number(e.target.value) || 1)} />
          </Field>
          <Field label="Cena krabičky (Kč)">
            <input type="number" value={settings.pricePerPack}
              onChange={e => updateSetting('pricePerPack', Number(e.target.value) || 0)} />
          </Field>
          <Field label="Interval připomínek (min)">
            <input type="number" value={settings.reminderMinutes}
              onChange={e => updateSetting('reminderMinutes', Number(e.target.value) || 1)} />
          </Field>
          <button className="big-btn" onClick={toggleReminders}>
            {settings.remindersOn ? '🔕 Vypnout připomínky' : '🔔 Zapnout připomínky'}
          </button>
          <p className="note">
            Notifikace vyjede do lišty telefonu podle nastaveného intervalu.
            Funguje, dokud máš appku na pozadí. Pro notifikace i po úplném
            zavření by byl potřeba server (Web Push).
          </p>

          <h2 style={{ marginTop: 24 }}>Resetování dat</h2>
          <button className="reset-btn" onClick={handleResetToday}>
            ↺ Vyresetovat dnešní den
          </button>
          <button className="reset-btn" onClick={handleResetWeek}>
            ↺ Vyresetovat tento týden
          </button>
          <button className="reset-btn danger" onClick={handleResetAll}>
            ⚠ Kompletní reset na nulu
          </button>
          <p className="note">
            Reset smaže příslušné záznamy cigaret. Kompletní reset navíc vynuluje
            i rekord nejdelší pauzy. Tuto akci nelze vrátit zpět.
          </p>

          <h2 style={{ marginTop: 24 }}>Záloha dat</h2>
          <button className="reset-btn" onClick={handleExport}>
            ⬇ Stáhnout zálohu (soubor)
          </button>
          <label className="reset-btn" style={{ display: 'block', textAlign: 'center' }}>
            ⬆ Načíst ze zálohy
            <input type="file" accept="application/json,.json"
              onChange={handleImport} style={{ display: 'none' }} />
          </label>
          <p className="note">
            Data jsou uložená jen v tomto telefonu. Zálohu si občas stáhni do
            souboru — při výměně telefonu nebo smazání appky ji načteš zpět a
            o nic nepřijdeš.
          </p>

          <h2 style={{ marginTop: 24 }}>Návod</h2>
          <button className="guide-toggle" onClick={() => setGuideOpen(o => !o)}>
            <span>📖 Jak appku používat</span>
            <span>{guideOpen ? '▲' : '▼'}</span>
          </button>
          {guideOpen && (
            <div className="guide">
              <p><strong>Domů</strong> — pokaždé, když si dáš cigaretu, klepni na „Měl jsem cigaretu". Tlačítko „Vymazat poslední cigaretu" smaže poslední omylem přidanou cigaretu.</p>
              <p><strong>Stopky a rekord</strong> — horní karta ukazuje, jak dlouho jsi bez cigarety. Pod ní je tvůj rekord nejdelší pauzy. Rekord se sám zvýší, jakmile aktuální pauza ten dosavadní překoná.</p>
              <p><strong>Tipy</strong> — karta s tipem na odvykání se sama střídá. Klepnutím zobrazíš další.</p>
              <p><strong>Připomínky</strong> — zapni je níže a nastav interval. Po uplynutí intervalu vyjede notifikace do lišty telefonu. Odpočet se restartuje pokaždé, když si zapíšeš cigaretu.</p>
              <p><strong>Cíle</strong> — nastav si denní/týdenní limit. Na hlavní stránce uvidíš ukazatel, kolik zbývá; po překročení zčervená.</p>
              <p><strong>Zdraví</strong> — podle aktuální pauzy ukazuje, co se v těle děje a kdy přijde další zlepšení (data podle WHO).</p>
              <p><strong>Grafy</strong> — sloupce cigaret za den, čára útraty, kalendářová heatmapa za 5 týdnů a graf, v kterou hodinu kouříš nejvíc.</p>
              <p><strong>Poznámky</strong> — u cigarety klepni „Ručně zadat" a přidej situaci (káva, stres…). Pomáhá najít spouštěče.</p>
              <p><strong>Záznamy</strong> — záložka se seznamem všech dnešních cigaret. Můžeš ručně přidat zpětně zapomenuté, upravit poznámku i jednotlivě mazat.</p>
              <p><strong>Vzhled</strong> — v nastavení přepneš tmavý/světlý režim.</p>
              <p><strong>Report</strong> — útrata za dnes, týden, měsíc a celkem. Peníze se počítají po celých krabičkách: 180 Kč naskočí až po dokouření 20 cigaret.</p>
              <p><strong>Denní popup</strong> — jednou denně se ukáže shrnutí včerejška (počet, útrata, nejdelší pauza).</p>
              <p><strong>Data</strong> — vše se ukládá jen v tomto telefonu, nic se nikam neposílá. V sekci Záloha dat si stáhni soubor a při výměně telefonu ho načteš zpět.</p>
              <p><strong>Ušetřeno</strong> — nastav původní denní spotřebu a v Reportu uvidíš, kolik jsi omezením ušetřil.</p>
            </div>
          )}

          <h2 style={{ marginTop: 24 }}>O aplikaci</h2>
          <div className="about">
            <p className="about-name">🚬 Lessmoke</p>
            <p className="about-claim">Kuř míň, šetři víc</p>
            <p className="about-desc">
              Lessmoke ti pomáhá omezit kouření a získat nad ním přehled.
              Zapisuješ vykouřené cigarety, sleduješ spotřebu a výdaje, plníš
              denní a týdenní cíle a díky zdravotním milníkům i statistice
              ušetřených peněz vidíš, jak se ti omezování vyplácí. Všechna data
              zůstávají jen v tvém telefonu.
            </p>
            <p className="about-sub">Vytvořil Dominik Kulich</p>
            <a className="about-link" href="https://www.dominikkulich.cz" target="_blank" rel="noopener noreferrer">
              www.dominikkulich.cz ↗
            </a>
          </div>
        </main>
      )}

      <nav className="tabbar">
        <button className={tab==='home'?'active':''} onClick={()=>setTab('home')}>Domů</button>
        <button className={tab==='log'?'active':''} onClick={()=>setTab('log')}>Záznamy</button>
        <button className={tab==='graphs'?'active':''} onClick={()=>setTab('graphs')}>Grafy</button>
        <button className={tab==='report'?'active':''} onClick={()=>setTab('report')}>Report</button>
        <button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}>Nastavení</button>
      </nav>

      {dailyPopup && (
        <div className="modal-overlay" onClick={() => setDailyPopup(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>📅 Shrnutí včerejška</h3>
            <p className="modal-date">
              {new Date(dailyPopup.date).toLocaleDateString('cs-CZ', { weekday:'long', day:'numeric', month:'long' })}
            </p>
            <div className="modal-stats">
              <div className="modal-stat">
                <span className="ms-value">{dailyPopup.count}</span>
                <span className="ms-label">cigaret</span>
              </div>
              <div className="modal-stat">
                <span className="ms-value">{dailyPopup.cost} Kč</span>
                <span className="ms-label">útrata</span>
              </div>
              <div className="modal-stat">
                <span className="ms-value">{dailyPopup.maxGap > 0 ? formatStreak(dailyPopup.maxGap) : '—'}</span>
                <span className="ms-label">nejdelší pauza</span>
              </div>
            </div>
            <p className="modal-msg">
              {dailyPopup.count === 0
                ? '🎉 Skvělé! Včera ani jedna cigareta.'
                : dailyPopup.count <= 5
                  ? '👍 Včera celkem v pohodě. Jen tak dál!'
                  : 'Dnes je nový den — zkus to o pár míň.'}
            </p>
            <button className="big-btn" onClick={() => setDailyPopup(null)}>
              Zavřít
            </button>
          </div>
        </div>
      )}

      {noteModal && (
        <div className="modal-overlay" onClick={() => { setNoteModal(false); setNoteText('') }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>✏️ Cigareta s poznámkou</h3>
            <input className="note-input" type="text" value={noteText}
              placeholder="Co tě k ní vedlo? (nepovinné)"
              onChange={e => setNoteText(e.target.value)}
              autoFocus />
            <div className="note-chips">
              {['káva', 'stres', 'po jídle', 'nuda', 'alkohol', 'ráno', 'parta'].map(chip => (
                <button key={chip}
                  className={`note-chip ${noteText === chip ? 'on' : ''}`}
                  onClick={() => setNoteText(chip)}>
                  {chip}
                </button>
              ))}
            </div>
            <button className="big-btn" onClick={handleSmokeWithNote}>
              ✓ Zapsat cigaretu
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>
              {editing.id ? '✏️ Upravit záznam' : '+ Přidat cigaretu'}
            </h3>
            <label className="edit-label">Čas</label>
            <input className="note-input" type="time" value={editing.time}
              onChange={e => setEditing({ ...editing, time: e.target.value })} />
            <label className="edit-label">Poznámka</label>
            <input className="note-input" type="text" value={editing.note}
              placeholder="Co tě k ní vedlo? (nepovinné)"
              onChange={e => setEditing({ ...editing, note: e.target.value })} />
            <div className="note-chips">
              {['káva', 'stres', 'po jídle', 'nuda', 'alkohol', 'ráno', 'parta'].map(chip => (
                <button key={chip}
                  className={`note-chip ${editing.note === chip ? 'on' : ''}`}
                  onClick={() => setEditing({ ...editing, note: chip })}>
                  {chip}
                </button>
              ))}
            </div>
            <button className="big-btn" onClick={editing.id
              ? handleSaveEdit
              : async () => { await handleAddManual(editing.time, editing.note); setEditing(null) }}>
              ✓ {editing.id ? 'Uložit změny' : 'Přidat cigaretu'}
            </button>
            {editing.id && (
              <button className="reset-btn danger" style={{ marginTop: 10 }}
                onClick={async () => { await handleDeleteRecord(editing.id); setEditing(null) }}>
                🗑 Smazat tento záznam
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function GoalBar({ label, count, goal }) {
  const pct = Math.min(100, Math.round((count / goal) * 100))
  const over = count > goal
  const remaining = goal - count
  return (
    <div>
      <div className="goal-head">
        <span className="goal-title">{label}</span>
        <span className={`goal-count ${over ? 'over' : ''}`}>
          {count} / {goal} ks
          {over ? ` · překročeno o ${count - goal}` : ` · zbývá ${remaining}`}
        </span>
      </div>
      <div className="goal-bar">
        <div className="goal-fill" style={{
          width: `${over ? 100 : pct}%`,
          background: over ? 'var(--danger)' : 'var(--accent)'
        }} />
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>  )
}

function MoneyCard({ label, count, cost, settings }) {
  const packs = Math.floor(count / settings.cigsPerPack)
  const intoNext = count % settings.cigsPerPack
  return (
    <div className="money-card">
      <span className="money-label">{label}</span>
      <span className="money-value">{cost} Kč</span>
      <span className="money-sub">
        {count} ks · {packs} {packs === 1 ? 'krabička' : (packs >= 2 && packs <= 4 ? 'krabičky' : 'krabiček')}
        {intoNext > 0 && ` (+${intoNext} ks rozkouřeno)`}
      </span>
    </div>
  )
}

function CigTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="tt">
      <div className="tt-day">{label}</div>
      <div className="tt-row"><span className="tt-dot" style={{background:'#38bdf8'}} />{payload[0].value} cigaret</div>
    </div>
  )
}

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="tt">
      <div className="tt-day">{label}</div>
      <div className="tt-row"><span className="tt-dot" style={{background:'#f87171'}} />{payload[0].value} Kč</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}
