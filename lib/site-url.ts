// Public address only. Never include database credentials here.
export const SITE_URL = 'https://ministeriovidaenlapalabra.online';
export function publicFormUrl(slug = 'visitantes'): string {
  return SITE_URL + '/registro/' + encodeURIComponent(slug);
}
