# ECOSKŁAD — wdrożenie na Cloudflare Pages

Instrukcja od zera do działającej strony pod `ecosklad.pl`. Całość zajmuje ok. 30 minut,
z czego większość to czekanie na propagację DNS.

---

## Co jest w projekcie

```
index.html                     → https://ecosklad.pl/
kalkulator-opalu/index.html    → https://ecosklad.pl/kalkulator-opalu
img/                           → zdjęcia
functions/send.js              → endpoint POST /send (dawny send.php)
_headers                       → nagłówki bezpieczeństwa i cache
robots.txt, sitemap.xml
```

Adresy bez `.html` biorą się ze struktury katalogów: podstrona to `index.html` w folderze o nazwie
adresu. Działa na każdym serwerze, bez konfiguracji. Katalog bez `index.html` zwraca 404,
nigdy listy plików.

---

## Krok 1 — repozytorium na GitHubie

Załóż puste repozytorium na github.com (bez README, bez .gitignore — mamy własny), potem:

```bash
cd ~/Desktop/ecosklad
git init
git add .
git commit -m "Strona ECOSKLAD"
git branch -M main
git remote add origin https://github.com/TWOJA-NAZWA/ecosklad.git
git push -u origin main
```

Sprawdź na GitHubie, czy widać `functions/send.js` i folder `img/`. Jeśli któregoś brakuje —
najczęściej wina `.gitignore`; `git status` pokaże co zostało pominięte.

---

## Krok 2 — podpięcie do Cloudflare Pages

1. Wejdź na **dash.cloudflare.com** (załóż konto, jeśli nie masz — darmowe)
2. Lewe menu → **Compute (Workers & Pages)** → **Create** → zakładka **Pages** →
   **Connect to Git**
3. Autoryzuj GitHuba i wybierz repozytorium `ecosklad`
4. Ustawienia builda:

   | Pole | Wartość |
   |---|---|
   | Project name | `ecosklad` |
   | Production branch | `main` |
   | Framework preset | **None** |
   | Build command | *(puste)* |
   | Build output directory | `/` |

5. **Save and Deploy**

Po ok. minucie dostaniesz adres `ecosklad.pages.dev`. Wejdź i sprawdź, czy strona się wyświetla
i czy działa przejście do `/kalkulator-opalu`. Formularz jeszcze nie zadziała — to Krok 3.

Od teraz **każdy `git push` na `main` automatycznie publikuje nową wersję.**

---

## Krok 3 — formularz kontaktowy (Resend)

`functions/send.js` wysyła maile przez [Resend](https://resend.com) — darmowo do 3000 maili
miesięcznie. Cloudflare nie ma własnej wysyłki poczty, więc potrzebna jest usługa zewnętrzna.

### 3a. Konto i domena w Resend

1. Załóż konto na **resend.com**
2. **Domains** → **Add Domain** → wpisz `ecosklad.pl`
3. Resend pokaże 3–4 rekordy DNS (MX, TXT dla SPF, TXT dla DKIM, opcjonalnie DMARC).
   Dodaj je tam, gdzie hostowany jest DNS domeny:
   - jeśli domena jest już w Cloudflare → **Websites** → `ecosklad.pl` → **DNS** → **Add record**
   - jeśli u innego rejestratora (OVH, home.pl, nazwa.pl) → panel DNS u nich
4. Wróć do Resend i kliknij **Verify**. Zwykle działa po kilku minutach, czasem po godzinie.

> Bez zweryfikowanej domeny Resend odmówi wysyłki z adresu `@ecosklad.pl`.

### 3b. Klucz API

**API Keys** → **Create API Key** → uprawnienia *Sending access* → skopiuj klucz
(zaczyna się od `re_`). Pokaże się **tylko raz**.

### 3c. Zmienne w Cloudflare

Pages → projekt `ecosklad` → **Settings** → **Variables and secrets** → **Add**.
Dodaj wszystkie trzy, dla środowiska **Production** *i* **Preview**:

| Nazwa | Typ | Wartość |
|---|---|---|
| `RESEND_API_KEY` | **Secret** | klucz `re_...` z Resend |
| `MAIL_TO` | Text | `biuro@ecosklad.pl` |
| `MAIL_FROM` | Text | `ECOSKŁAD formularz <formularz@ecosklad.pl>` |

`MAIL_FROM` musi być adresem z domeny zweryfikowanej w Resend. Sama skrzynka
`formularz@ecosklad.pl` nie musi istnieć — to tylko adres nadawcy. Odpowiedzi i tak trafią
do osoby, która wypełniła formularz, bo funkcja ustawia `Reply-To` na jej adres.

### 3d. Redeploy

Zmienne działają dopiero od kolejnego deploya: **Deployments** → ostatni wpis →
**⋯** → **Retry deployment**.

Wejdź na stronę, wyślij testowe zapytanie przez formularz i sprawdź skrzynkę.

---

## Krok 4 — własna domena

Pages → projekt `ecosklad` → **Custom domains** → **Set up a domain**.

Dodaj oba warianty: `ecosklad.pl` **i** `www.ecosklad.pl`.

- **Domena już w Cloudflare** → rekordy dopiszą się automatycznie, certyfikat SSL w kilka minut.
- **Domena u innego rejestratora** → masz dwie opcje:
  - przenieść nameservery do Cloudflare (Cloudflare pokaże jakie wpisać) — polecane,
    bo wtedy DNS dla Resend i Pages jest w jednym miejscu;
  - albo dodać u rejestratora rekord `CNAME` wskazujący na `ecosklad.pages.dev`.

Certyfikat HTTPS Cloudflare wystawia sam, nic nie trzeba kupować.

---

## Test lokalny

Zwykły serwer statyczny (Live Server w VS Code, `npx serve .`) pokaże stronę i nawigację,
ale **nie uruchomi** `functions/send.js` — formularz zwróci błąd. To normalne.

Żeby przetestować także formularz:

```bash
npx wrangler pages dev .
```

Klucz do lokalnych testów wpisz w pliku `.dev.vars` (jest w `.gitignore`, nie trafi na GitHuba):

```
RESEND_API_KEY=re_xxxxxxxx
```

---

## Gdy coś nie działa

| Objaw | Przyczyna |
|---|---|
| `Cannot GET /kalkulator-opalu` lokalnie | serwer statyczny bez obsługi katalogów — użyj `npx wrangler pages dev .` |
| Formularz: „Formularz nie jest skonfigurowany" | brak `RESEND_API_KEY` albo nie zrobiono redeploya po dodaniu zmiennych |
| Formularz: „Nie udało się wysłać wiadomości" | domena niezweryfikowana w Resend albo `MAIL_FROM` spoza tej domeny. Log błędu: Pages → **Functions** → **Real-time logs** |
| Strona pokazuje starą wersję | cache przeglądarki — Ctrl+Shift+R. Cloudflare czyści swój cache przy każdym deployu |
| Zmiany nie pojawiają się po pushu | sprawdź **Deployments** — build mógł się nie uruchomić albo poszedł na inną gałąź niż `main` |

---

## Uwagi

- **GitHub Pages nie uruchomi** `functions/send.js` — obsługuje wyłącznie pliki statyczne.
  Sama strona by działała, formularz nie. Dlatego Cloudflare.
- Plan darmowy Cloudflare Pages: bez limitu transferu, 500 buildów miesięcznie,
  100 000 wywołań funkcji dziennie. Dla tej strony z ogromnym zapasem.
- W `img/` leżą pliki nieużywane przez stronę: `baner-magazyn-alt.jpg` i `nasyp-wegla.jpg`
  (alternatywne wersje zdjęć, do podmiany jeśli obecne się znudzą) oraz stare
  `cand-salon`, `cand-worki`, `doradca`, `dostawa-transport`, `ekogroszek-szary`,
  `modul-kontakt` — te ostatnie można skasować.
