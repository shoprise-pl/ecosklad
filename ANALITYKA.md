# Analityka i reklamy — konfiguracja krok po kroku

Kod na stronie jest gotowy. Zostało założyć konta, wkleić dwa identyfikatory i poskładać tagi
w Google Tag Managerze. Licz na dwie godziny za pierwszym razem.

---

## Co już jest w kodzie

| Element | Gdzie | Stan |
|---|---|---|
| Google Consent Mode v2 (domyślnie wszystko odrzucone) | `<head>` obu stron | gotowe |
| Cookiebot z auto-blokowaniem | `<head>`, zaraz po Consent Mode | **czeka na ID** |
| Kontener Google Tag Manager | `<head>` + `<noscript>` w `<body>` | **czeka na ID** |
| Zdarzenie `generate_lead` (wysłany formularz) | `index.html` | gotowe |
| Zdarzenie `kalkulator_do_wyceny` | `kalkulator-opalu/` | gotowe |
| Zdarzenia `click_to_call` i `click_to_mail` | obie strony | gotowe |
| Polityka prywatności + link w stopce | `/polityka-prywatnosci` | **czeka na NIP i nazwę firmy** |

GA4, Google Ads i Meta Pixel **nie są wklejone w kod** — i nie powinny być. Wszystkie trzy
konfiguruje się wewnątrz GTM. Dzięki temu późniejsze zmiany nie wymagają dotykania strony
ani deploya.

---

## Krok 1 — Google Tag Manager

1. [tagmanager.google.com](https://tagmanager.google.com) → **Utwórz konto**
2. Nazwa konta: ECOSKŁAD, kraj: Polska
3. Kontener: `ecosklad.pl`, typ **Sieć**
4. Skopiuj identyfikator, wygląda tak: `GTM-ABC1234`
5. Podmień w obu plikach — są **cztery** miejsca z `GTM-XXXXXXX`:

```bash
cd ~/Desktop/ecosklad
grep -rn "GTM-XXXXXXX" index.html kalkulator-opalu/index.html
```

Zamień wszystkie na swój identyfikator (w edytorze: Zamień wszystko).

---

## Krok 2 — Cookiebot

1. [cookiebot.com](https://www.cookiebot.com) → załóż konto, plan **Free** (do 50 podstron, masz 3)
2. **Add domain** → `ecosklad.pl` → uruchom pierwszy skan
3. **Your scripts** → skopiuj wartość `data-cbid` (długi ciąg z myślnikami)
4. Podmień `WKLEJ-ID-COOKIEBOT` w obu plikach
5. W panelu Cookiebot ustaw:
   - **Language**: Polski
   - **Consent banner** → wariant z przyciskami *Zezwól na wszystkie* i *Odmów* obok siebie.
     Przycisk odmowy musi być tak samo widoczny jak zgody — inaczej zgoda nie jest ważna w świetle RODO
   - **Privacy policy URL**: `https://ecosklad.pl/polityka-prywatnosci`
   - **Google Consent Mode**: włączone

---

## Krok 3 — GA4

1. [analytics.google.com](https://analytics.google.com) → utwórz usługę **ECOSKŁAD**, strefa Warszawa, waluta PLN
2. Strumień danych → **Sieć** → `https://ecosklad.pl` → skopiuj `G-XXXXXXXXXX`
3. W GTM: **Tagi** → **Nowy** → typ **Google Tag**
   - Identyfikator tagu: Twoje `G-XXXXXXXXXX`
   - Reguła: **Initialization — All Pages**
4. **Nie wklejaj** tego identyfikatora do kodu strony.

---

## Krok 4 — konwersje w GTM

Najpierw zmienne, potem reguły, na końcu tagi.

### Zmienne warstwy danych

**Zmienne** → **Nowa** → *Zmienna warstwy danych*. Utwórz cztery, nazwa zmiennej dokładnie jak niżej:

`temat_zapytania`, `miejscowosc`, `szacowany_koszt`, `kontakt`

### Reguły (triggery)

**Reguły** → **Nowa** → *Zdarzenie niestandardowe*:

| Nazwa reguły | Nazwa zdarzenia |
|---|---|
| Lead — formularz wysłany | `generate_lead` |
| Kalkulator — przeniesiono do wyceny | `kalkulator_do_wyceny` |
| Klik w telefon | `click_to_call` |

### Tagi GA4

**Tagi** → **Nowa** → *Google Analytics: zdarzenie GA4*, tag konfiguracyjny wskaż na swój Google Tag:

| Nazwa tagu | Nazwa zdarzenia | Reguła |
|---|---|---|
| GA4 — lead | `generate_lead` | Lead — formularz wysłany |
| GA4 — kalkulator | `kalkulator_do_wyceny` | Kalkulator — przeniesiono do wyceny |
| GA4 — telefon | `click_to_call` | Klik w telefon |

W tagu GA4 „lead" dodaj parametry zdarzenia: `temat_zapytania` i `miejscowosc` — dzięki temu
zobaczysz w raportach, o co pytają najczęściej i skąd są.

### Google Ads

1. W Google Ads: **Cele** → **Konwersje** → **Nowa akcja powodująca konwersję** → *Witryna* →
   ustaw ręcznie. Utwórz dwie: **Formularz** (kategoria: Prześlij formularz kontaktowy) i
   **Telefon** (kategoria: Kliknięcie numeru telefonu)
2. Zapisz `Conversion ID` (`AW-XXXXXXXXX`) i `Conversion Label` każdej z nich
3. W GTM dodaj tag *Konwersja Google Ads* dla każdej, z odpowiednią regułą z tabeli wyżej
4. Dodaj też tag *Google Ads — tag remarketingowy* z regułą **All Pages**

### Meta Pixel

1. [business.facebook.com](https://business.facebook.com) → **Menedżer zdarzeń** → **Połącz źródła
   danych** → *Internet* → **Piksel Meta** → skopiuj numer piksela
2. W GTM: **Szablony** → **Galeria szablonów tagów** → wyszukaj **Facebook Pixel** (autor: facebookarchive)
   → **Dodaj do obszaru roboczego**
3. Utwórz dwa tagi:
   - *PageView* z regułą **All Pages**
   - *Lead* z regułą **Lead — formularz wysłany**
4. W obu tagach otwórz **Zaawansowane ustawienia** → **Dodatkowe sprawdzanie zgody** →
   *Nie uruchamiaj tagu, dopóki nie pojawią się zgody* → zaznacz `ad_storage` i `ad_user_data`.

Ten ostatni punkt jest kluczowy. Meta Pixel nie rozumie Consent Mode tak jak tagi Google —
bez tego ustawienia odpaliłby się mimo odmowy zgody, co jest naruszeniem RODO.

---

## Krok 5 — sprawdzenie przed publikacją

W GTM kliknij **Podgląd** i przejdź przez stronę:

1. **Przed kliknięciem w baner** — w zakładce *Consent* wszystkie zgody poza `security_storage`
   mają być `denied`. Żaden tag GA4 ani Meta nie może być odpalony
2. **Kliknij „Odmów"** — nadal nic marketingowego się nie uruchamia
3. **Odśwież, kliknij „Zezwól na wszystkie"** — zgody przechodzą na `granted`, GA4 wysyła `page_view`
4. **Wyślij testowe zapytanie przez formularz** — pojawia się `generate_lead`, a w nim
   `temat_zapytania` i `miejscowosc`
5. **Kliknij numer telefonu** — pojawia się `click_to_call`

Dopiero gdy wszystkie pięć punktów przechodzi, kliknij **Prześlij** i opublikuj kontener.

---

## Krok 6 — uzupełnij politykę prywatności

Otwórz `polityka-prywatnosci/index.html` i podmień trzy pola w sekcji 1:
pełną nazwę firmy, NIP i REGON. Usuń też żółtą ramkę z adnotacją na górze — to notatka dla Ciebie,
nie dla odwiedzających. Znajdziesz ją po klasie `todo`.

Google Ads i Meta wymagają działającego adresu polityki prywatności przy weryfikacji konta
reklamowego, więc to nie jest krok do odłożenia na potem.

---

## Uwagi

- **Nie wklejaj żadnych tagów bezpośrednio do HTML.** Wszystko przez GTM — inaczej ominiesz
  mechanizm zgód i stracisz kontrolę nad tym, co się kiedy uruchamia.
- **Consent Mode v2 jest obowiązkowy** dla reklamodawców kierujących reklamy na EOG od 6 marca 2024.
  Bez niego tracisz remarketing i modelowane konwersje w Google Ads.
- **Certyfikowana platforma zgód** jest wymagana przez Google do modelowania konwersji.
  Cookiebot jest na liście certyfikowanych, dlatego padł na niego wybór.
- **Zdarzenia w warstwie danych już działają**, niezależnie od tego czy GTM jest podpięty.
  Możesz je podejrzeć w konsoli przeglądarki: wpisz `dataLayer` i wyślij formularz.
