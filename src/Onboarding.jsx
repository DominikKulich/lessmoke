import { useState } from 'react'

// Úvodní průvodce při prvním spuštění. Provede uživatele základním nastavením.
// onDone(values) dostane zadané hodnoty a uloží je + označí onboarding za hotový.
export default function Onboarding({ defaults, onDone }) {
  const [step, setStep] = useState(0)
  const [reminderMinutes, setReminderMinutes] = useState(defaults.reminderMinutes || 60)
  const [cigsPerPack, setCigsPerPack] = useState(defaults.cigsPerPack || 20)
  const [pricePerPack, setPricePerPack] = useState(defaults.pricePerPack || 180)
  const [baselinePerDay, setBaselinePerDay] = useState(defaults.baselinePerDay || 0)

  const totalSteps = 4

  function next() {
    if (step < totalSteps - 1) setStep(step + 1)
    else finish()
  }
  function finish() {
    onDone({
      reminderMinutes: Number(reminderMinutes) || 60,
      cigsPerPack: Number(cigsPerPack) || 20,
      pricePerPack: Number(pricePerPack) || 0,
      baselinePerDay: Number(baselinePerDay) || 0,
      onboarded: true
    })
  }

  return (
    <div className="onb-overlay">
      <div className="onb-card">
        <div className="onb-dots">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span key={i} className={`onb-dot ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="onb-step">
            <div className="onb-emoji">🚬</div>
            <h2 className="onb-title">Vítej v Lessmoke</h2>
            <p className="onb-text">
              Pomůžu ti omezit kouření a získat nad ním přehled. Zapisuješ
              cigarety, sleduješ výdaje a vidíš, jak ti omezování prospívá.
              Pojďme to nejdřív nastavit — zabere to chvilku.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="onb-step">
            <div className="onb-emoji">⏰</div>
            <h2 className="onb-title">Interval připomínek</h2>
            <p className="onb-text">
              Jak často ti má appka připomenout? Nastav rozumný odstup — appka
              tě upozorní, až uplyne. Můžeš to kdykoli změnit v nastavení.
            </p>
            <label className="onb-field">
              <span>Interval (minuty)</span>
              <input type="number" value={reminderMinutes}
                onChange={e => setReminderMinutes(e.target.value)} />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="onb-step">
            <div className="onb-emoji">💰</div>
            <h2 className="onb-title">Cena cigaret</h2>
            <p className="onb-text">
              Kolik stojí krabička a kolik je v ní cigaret? Z toho appka spočítá,
              kolik za kouření utrácíš.
            </p>
            <label className="onb-field">
              <span>Cena krabičky (Kč)</span>
              <input type="number" value={pricePerPack}
                onChange={e => setPricePerPack(e.target.value)} />
            </label>
            <label className="onb-field">
              <span>Cigaret v krabičce</span>
              <input type="number" value={cigsPerPack}
                onChange={e => setCigsPerPack(e.target.value)} />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="onb-step">
            <div className="onb-emoji">📉</div>
            <h2 className="onb-title">Tvoje původní spotřeba</h2>
            <p className="onb-text">
              Kolik cigaret denně kouříš teď? Podle toho ti appka ukáže, kolik
              jsi omezením ušetřil. Nech 0, pokud to teď řešit nechceš.
            </p>
            <label className="onb-field">
              <span>Cigaret za den</span>
              <input type="number" value={baselinePerDay}
                onChange={e => setBaselinePerDay(e.target.value)} />
            </label>
          </div>
        )}

        <button className="onb-btn" onClick={next}>
          {step === totalSteps - 1 ? '✓ Začít používat' : 'Pokračovat'}
        </button>
        {step > 0 && step < totalSteps - 1 && (
          <button className="onb-skip" onClick={finish}>Přeskočit nastavení</button>
        )}
      </div>
    </div>
  )
}
