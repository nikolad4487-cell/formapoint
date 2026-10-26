export const promotionThemes = {
  christmas: {
    label: 'Božić',
    subject: '{ime}, božićni poklon od FormaPointa',
    message:
      'Pozdrav {ime}!\nZa Božić ti darujemo {popust} popusta. Tvoj osobni kod je {kod}.\nVrijedi od {od} do {do}. Želimo ti sretan Božić i uspješne projekte!',
    image: '/promotions/christmas.jpg',
  },
  birthday: {
    label: 'Rođendan',
    subject: 'Sretan rođendan, {ime}! Tvoj FormaPoint poklon',
    message:
      'Sretan rođendan, {ime}!\nPoklanjamo ti {popust} popusta uz osobni kod {kod}.\nKod vrijedi od {od} do {do}. Želimo ti lijep dan i puno uspjeha!',
    image: '/promotions/birthday.jpg',
  },
  easter: {
    label: 'Uskrs',
    subject: '{ime}, uskrsni poklon od FormaPointa',
    message:
      'Pozdrav {ime}!\nZa Uskrs smo ti pripremili {popust} popusta. Iskoristi svoj kod {kod} od {od} do {do}.\nSretan Uskrs želi ti FormaPoint!',
    image: '/promotions/easter.jpg',
  },
  custom: {
    label: 'Posebna promocija',
    subject: '{ime}, poseban poklon od FormaPointa',
    message:
      'Pozdrav {ime}!\nZa tebe smo pripremili {popust} popusta. Tvoj osobni kod {kod} vrijedi od {od} do {do}.\nVeselimo se tvojim novim projektima!',
    image: '/promotions/birthday.jpg',
  },
};
export type PromotionOccasion = keyof typeof promotionThemes;
export interface PromotionEmail {
  recipient_name: string;
  code: string;
  kind: string;
  value: number;
  starts_at: string;
  expires_at: string;
  subject: string;
  message: string;
  image_url: string;
  occasion: string;
}
export function promotionText(value: string, job: PromotionEmail) {
  const date = (s: string) =>
    new Intl.DateTimeFormat('hr-HR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Zagreb',
    }).format(new Date(s));
  const vars: Record<string, string> = {
    ime: job.recipient_name,
    kod: job.code,
    popust:
      job.kind === 'percent'
        ? `${job.value} %`
        : new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(
            job.value / 100,
          ),
    od: date(job.starts_at),
    do: date(job.expires_at),
  };
  return value.replace(/\{(ime|kod|popust|od|do)\}/g, (_, key) => vars[key]);
}
const escape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
export function promotionEmail(job: PromotionEmail, app: string, unsubscribe: string) {
  const url = new URL(job.image_url);
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('InvalidPromotionImage');
  const message = promotionText(job.message, job),
    subject = promotionText(job.subject, job).replace(/[\r\n]/g, ' ');
  const label = promotionThemes[job.occasion as PromotionOccasion]?.label || 'Posebna promocija';
  return {
    subject,
    text: `${message}\n\nKod: ${job.code}\nKod vrijedi samo za vaš račun, jednokratno. Unesite ga u košarici.\n${app}/usluge\nOdjava s promotivnih poruka: ${unsubscribe}`,
    html: `<!doctype html><html lang="hr"><body style="margin:0;background:#f3f5ff;font-family:Arial,sans-serif;color:#17204b"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="600" style="max-width:600px;width:100%;background:white;border-radius:18px;overflow:hidden"><tr><td style="padding:22px;color:#3155f6;font-size:24px;font-weight:bold">FormaPoint · ${escape(label)}</td></tr><tr><td><img src="${escape(job.image_url)}" width="600" alt="${escape(label)} — FormaPoint promocija" style="display:block;width:100%;height:auto;border:0"></td></tr><tr><td style="padding:26px;line-height:1.7"><p>${escape(message).replace(/\n/g, '<br>')}</p><p style="text-align:center;padding:18px;background:#eef0ff;border:1px dashed #7161ef;font-size:22px;font-weight:bold;letter-spacing:1px;overflow-wrap:anywhere">${escape(job.code)}</p><p>Kod vrijedi samo za vaš račun i može se iskoristiti jednom. Unesite ga u košarici prije potvrde narudžbe.</p><p><a href="${escape(app)}/usluge" style="display:inline-block;background:#4937ee;color:white;padding:12px 22px;border-radius:10px;text-decoration:none">Pogledaj usluge</a></p><p style="font-size:12px;color:#6b728b">Pitanja: info@formapoint.online<br><a href="${escape(unsubscribe)}">Odjava s promotivnih poruka</a></p></td></tr></table></td></tr></table></body></html>`,
  };
}
