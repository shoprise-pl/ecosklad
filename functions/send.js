/**
 * Obsługa formularza kontaktowego ECOSKŁAD — Cloudflare Pages Function.
 * Odpowiada pod adresem /send (nazwa pliku = ścieżka URL).
 * Zastępuje dawny send.php.
 *
 * Wymagane zmienne środowiskowe (Cloudflare Pages → Settings → Variables):
 *   RESEND_API_KEY  — klucz API z resend.com (ustaw jako "Secret")
 *
 * Opcjonalne (mają sensowne wartości domyślne):
 *   MAIL_TO         — odbiorca, domyślnie biuro@ecosklad.pl
 *   MAIL_FROM       — nadawca, MUSI być z domeny zweryfikowanej w Resend
 */

const DOMYSLNY_ODBIORCA = 'biuro@ecosklad.pl';
const DOMYSLNY_NADAWCA = 'ECOSKŁAD formularz <formularz@ecosklad.pl>';

const LIMITY = {
  imie: 80,
  telefon: 20,
  email: 120,
  miejscowosc: 80,
  temat: 80,
  wiadomosc: 2000,
};

function odpowiedz(kod, tresc) {
  return new Response(tresc, {
    status: kod,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let dane;
  try {
    const typ = request.headers.get('content-type') || '';
    if (typ.includes('application/json')) {
      dane = await request.json();
    } else {
      dane = Object.fromEntries(await request.formData());
    }
  } catch (e) {
    return odpowiedz(400, 'Nieprawidłowe dane.');
  }

  const pole = (klucz) => {
    const max = LIMITY[klucz] || 200;
    return String(dane[klucz] ?? '').trim().slice(0, max);
  };

  // honeypot: prawdziwy użytkownik nie widzi tego pola
  if (String(dane.firma_www ?? '').trim() !== '') {
    return odpowiedz(200, 'OK'); // udajemy sukces, żeby bot nie próbował ponownie
  }

  const imie = pole('imie');
  const telefon = pole('telefon');
  const email = pole('email');
  const miejscowosc = pole('miejscowosc');
  const temat = pole('temat');
  const wiadomosc = pole('wiadomosc');
  const zgoda = !!dane.zgoda;

  const bledy = [];
  if (!imie) bledy.push('imię');
  if (!/[0-9]{9}/.test(telefon.replace(/\D/g, ''))) bledy.push('telefon');
  if (!wiadomosc) bledy.push('wiadomość');
  if (!zgoda) bledy.push('zgoda na kontakt');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) bledy.push('e-mail');

  if (bledy.length) {
    return odpowiedz(422, 'Uzupełnij: ' + bledy.join(', '));
  }

  // blokada wstrzykiwania nagłówków
  for (const v of [imie, email, telefon, temat]) {
    if (/[\r\n]/.test(v)) return odpowiedz(400, 'Nieprawidłowe dane.');
  }

  if (!env.RESEND_API_KEY) {
    return odpowiedz(500, 'Formularz nie jest skonfigurowany. Zadzwoń pod 663 798 903.');
  }

  const czas = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
  const ip = request.headers.get('cf-connecting-ip') || 'brak';
  const kraj = request.cf?.country || 'brak';

  const tytul = 'Zapytanie ze strony: ' + (temat || 'formularz kontaktowy');

  const wiersze = [
    ['Imię i nazwisko', imie],
    ['Telefon', telefon],
    ['E-mail', email || 'nie podano'],
    ['Miejscowość', miejscowosc || 'nie podano'],
    ['Temat', temat || 'nie podano'],
  ];

  const tekst = [
    'Nowe zapytanie z ecosklad.pl',
    '-'.repeat(40),
    ...wiersze.map(([k, v]) => k.padEnd(17) + v),
    '-'.repeat(40),
    'Wiadomość:',
    wiadomosc,
    '-'.repeat(40),
    'Wysłano: ' + czas,
    'IP:      ' + ip + ' (' + kraj + ')',
  ].join('\n');

  const html = `<!doctype html><meta charset="utf-8">
<div style="font:15px/1.55 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1c1c1c;max-width:600px">
  <h2 style="margin:0 0 4px;font-size:18px">Nowe zapytanie z ecosklad.pl</h2>
  <p style="margin:0 0 16px;color:#777;font-size:13px">${escapeHtml(czas)}</p>
  <table style="border-collapse:collapse;width:100%;margin-bottom:16px">
    ${wiersze
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 12px 6px 0;color:#777;white-space:nowrap;vertical-align:top">${escapeHtml(
            k
          )}</td><td style="padding:6px 0;font-weight:600">${escapeHtml(v)}</td></tr>`
      )
      .join('')}
  </table>
  <div style="padding:14px 16px;background:#f6f6f4;border-left:3px solid #d4762a;border-radius:4px;white-space:pre-wrap">${escapeHtml(
    wiadomosc
  )}</div>
  <p style="margin:16px 0 0;color:#999;font-size:12px">IP: ${escapeHtml(ip)} (${escapeHtml(kraj)})</p>
</div>`;

  const payload = {
    from: env.MAIL_FROM || DOMYSLNY_NADAWCA,
    to: [env.MAIL_TO || DOMYSLNY_ODBIORCA],
    subject: tytul,
    text: tekst,
    html: html,
  };
  if (email) payload.reply_to = email;

  let wyslano = false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    wyslano = r.ok;
    if (!r.ok) console.error('Resend ' + r.status + ': ' + (await r.text()));
  } catch (e) {
    console.error('Resend fetch error', e);
  }

  if (!wyslano) {
    return odpowiedz(500, 'Nie udało się wysłać wiadomości.');
  }

  // formularz wysyła żądanie AJAX-em i oczekuje odpowiedzi tekstowej
  const accept = request.headers.get('accept') || '';
  if (accept.includes('application/json')) {
    return odpowiedz(200, 'OK');
  }

  // zapasowo, gdy JavaScript jest wyłączony
  return Response.redirect(new URL('/?wyslano=1#kontakt', request.url).toString(), 303);
}

// GET/PUT/... na /send
export async function onRequest() {
  return odpowiedz(405, 'Metoda niedozwolona.');
}
