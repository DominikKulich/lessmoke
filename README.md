# 🚬 Lessmoke

**Kuř míň, šetři víc.** PWA pomocník s omezením kouření — přehled spotřeby, výdajů, cíle a zdravotní milníky.
Data se ukládají **lokálně v telefonu** (IndexedDB) — nic se nikam neposílá.

## Funkce
- Tlačítko „Měl jsem cigaretu" + vzít zpět
- Stopky od poslední cigarety
- Statistiky: dnes / týden / celkem
- Grafy spotřeby a výdajů (14 dní)
- Report za období s útratou
- Výpočet ceny: každých 20 cigaret = +180 Kč (lze změnit v Nastavení)
- Připomínky v nastavitelném intervalu (fungují, dokud je appka otevřená)

## Jak to spustit lokálně
```bash
npm install
npm run dev
```
Pak otevři adresu, kterou vypíše terminál (např. http://localhost:5173/cig-tracker/).

## Jak nasadit na GitHub Pages (zdarma)

1. Vytvoř na GitHubu nový **public** repozitář s názvem `cig-tracker`.
   (Pokud zvolíš jiný název, změň `base` ve `vite.config.js` a `start_url`/`scope` v manifestu.)

2. Nahraj kód:
   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/TVUJ-USERNAME/cig-tracker.git
   git push -u origin main
   ```

3. V repu: **Settings → Pages → Source → vyber „GitHub Actions"**.

4. Po pushnutí se sám spustí workflow `.github/workflows/deploy.yml`.
   Hotová appka poběží na:
   `https://TVUJ-USERNAME.github.io/cig-tracker/`

5. Na Androidu otevři tu adresu v Chrome → menu (⋮) → **„Přidat na plochu"**.
   Tím se nainstaluje jako appka a notifikace budou fungovat.

## Poznámka k notifikacím
Připomínky běží, dokud máš appku spuštěnou (na Androidu chvíli vydrží i na
pozadí). Pro spolehlivé notifikace i po úplném zavření by byl potřeba server
s Web Push — to je nad rámec téhle čistě lokální verze.
