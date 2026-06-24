// Tipy, jak omezit nebo přestat s kouřením. Na hlavní stránce se střídají.
export const TIPS = [
  'Když přijde chuť, počkej 5 minut. Většina nutkání odezní sama.',
  'Napij se sklenice vody pokaždé, když máš chuť na cigaretu.',
  'Odlož první ranní cigaretu o 15 minut. Postupně přidávej.',
  'Vyhni se situacím, které spouští chuť — třeba kávě nebo alkoholu.',
  'Zaměstnej ruce: zmáčkni antistresový míček nebo si vezmi žvýkačku.',
  'Spočítej si, co ušetříš za měsíc bez kouření. Ta částka motivuje.',
  'Řekni blízkým, že omezuješ. Podpora okolí pomáhá vydržet.',
  'Krátká procházka odvede pozornost od chuti rychleji než cokoli jiného.',
  'Po jídle si místo cigarety vyčisti zuby — chuť mentolu kouření odradí.',
  'Hluboce se nadechni desetkrát. Nahradí to „uklidnění" z cigarety.',
  'Schovej zapalovač i krabičku z dohledu. Co nevidíš, po tom míň sáhneš.',
  'Stanov si denní limit a každý týden ho sniž o jednu cigaretu.',
  'Odměň se za každý den pod limitem něčím malým, co máš rád.',
  'Nikotinová náplast nebo žvýkačka usnadní začátek — zeptej se v lékárně.',
  'Jeden šluk neznamená prohru. Pokračuj dál podle plánu.',
  'Drž ruce a pusu zaměstnané — křupej mrkev, celer nebo oříšky.',
  'Připomeň si konkrétní důvod, proč chceš přestat. Napiš si ho na papírek.',
  'Chuť trvá obvykle jen 3–5 minut. Přečkej ji a vyhrál jsi.',
  'Vyhýbej se na čas kuřáckým partám, dokud chuť nezeslábne.',
  'Každá nevykouřená cigareta je malé vítězství. Sčítej je.'
]

// Vrátí tip podle indexu (cyklicky)
export function tipAt(i) {
  return TIPS[((i % TIPS.length) + TIPS.length) % TIPS.length]
}
