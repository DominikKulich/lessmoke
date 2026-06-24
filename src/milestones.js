// Zdravotní milníky po vykouření poslední cigarety.
// Zdroj: WHO (who.int) + American Heart Association. Časy v ms od poslední cigarety.
export const HEALTH_MILESTONES = [
  { ms: 20 * 60 * 1000,            title: 'Tep a krevní tlak klesají', desc: 'Srdce se vrací k normálu, krevní oběh se zlepšuje.' },
  { ms: 12 * 3600 * 1000,         title: 'Kysličník uhelnatý mizí', desc: 'Hladina CO v krvi klesá na normál, do těla proudí víc kyslíku.' },
  { ms: 2 * 24 * 3600 * 1000,     title: 'Vrací se chuť a čich', desc: 'Nervová zakončení se zotavují, jídlo začne víc chutnat.' },
  { ms: 3 * 24 * 3600 * 1000,     title: 'Nikotin je z těla pryč', desc: 'Dýchá se lehčeji. Chuť na cigaretu teď bývá nejsilnější — vydrž.' },
  { ms: 14 * 24 * 3600 * 1000,    title: 'Lepší krevní oběh', desc: 'Oběh i plicní funkce se začínají zlepšovat.' },
  { ms: 30 * 24 * 3600 * 1000,    title: 'Méně kašle a dušnosti', desc: 'Plíce se čistí, snáz se dýchá při námaze.' },
  { ms: 270 * 24 * 3600 * 1000,   title: 'Plíce o 10 % silnější', desc: 'Plicní funkce výrazně vzrostla, řasinky v plicích pracují.' },
  { ms: 365 * 24 * 3600 * 1000,   title: 'Poloviční riziko pro srdce', desc: 'Riziko ischemické choroby srdeční je poloviční oproti kuřákovi.' }
]

// Vrátí { current, next, progress } podle uplynulého času (ms).
// current = poslední dosažený milník (nebo null), next = nejbližší další (nebo null),
// progress = 0..1 postup mezi current a next.
export function milestoneStatus(elapsedMs) {
  let current = null
  let next = null
  for (let i = 0; i < HEALTH_MILESTONES.length; i++) {
    if (elapsedMs >= HEALTH_MILESTONES[i].ms) {
      current = HEALTH_MILESTONES[i]
    } else {
      next = HEALTH_MILESTONES[i]
      break
    }
  }
  let progress = 1
  if (next) {
    const from = current ? current.ms : 0
    progress = Math.min(1, Math.max(0, (elapsedMs - from) / (next.ms - from)))
  }
  return { current, next, progress }
}
