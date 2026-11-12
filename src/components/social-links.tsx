import { MessageCircle, ArrowUpRight } from 'lucide-react';
import { useSiteSettings } from '../hooks/use-site-settings';

function safeLink(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function SocialIcon({ name }: { name: string }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'Facebook' ? (
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      ) : name === 'Instagram' ? (
        <>
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <rect x="3" y="9" width="4" height="12" />
          <circle cx="5" cy="4.5" r="2" />
          <path d="M11 21V9h4v2c1-3 6-3 6 2v8h-4v-7c0-2-2-2-2 0v7z" />
        </>
      )}
    </svg>
  );
}

export function SocialLinks() {
  const { data: site } = useSiteSettings();
  const links = [
    { name: 'Facebook', url: safeLink(site?.facebook_url) },
    { name: 'Instagram', url: safeLink(site?.instagram_url) },
    { name: 'LinkedIn', url: safeLink(site?.linkedin_url) },
  ].filter((link) => link.url);
  const whatsapp = safeLink(site?.whatsapp_community_url);
  if (!links.length && !whatsapp) return null;
  return (
    <div className="footer-social" aria-label="FormaPoint na društvenim mrežama">
      {links.length > 0 && (
        <div className="footer-social-icons">
          {links.map(({ name, url }) => (
            <a
              key={name}
              href={url!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={name}
              title={name}
            >
              <SocialIcon name={name} />
            </a>
          ))}
        </div>
      )}
      {whatsapp && (
        <a className="whatsapp-community" href={whatsapp} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={21} aria-hidden="true" />
          <span>Pridruži se WhatsApp zajednici</span>
          <ArrowUpRight size={17} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}
