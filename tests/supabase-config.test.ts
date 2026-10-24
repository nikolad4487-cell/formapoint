import { describe, it, expect } from 'vitest';
import { resolveSupabaseConfig } from '../src/lib/supabase-config';
const project = {
  url: 'https://project.supabase.co',
  publishableKey: 'sb_publishable_public_example',
};
describe('Javna Supabase konfiguracija', () => {
  it('build bez env varijabli koristi konfigurirani projekt', () => {
    const result = resolveSupabaseConfig({}, project);
    expect(result.configured).toBe(true);
    expect(result.source).toBe('project');
    expect(result.url).toBe(project.url);
  });
  it('env par ima prednost nad projektnim postavkama', () => {
    const result = resolveSupabaseConfig(
      {
        VITE_SUPABASE_URL: 'https://other.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_other',
      },
      project,
    );
    expect(result.configured).toBe(true);
    expect(result.url).toBe('https://other.supabase.co');
    expect(result.key).toBe('sb_publishable_other');
  });
  it('prazne hosting varijable ne blokiraju projektnu konfiguraciju', () =>
    expect(
      resolveSupabaseConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' }, project)
        .configured,
    ).toBe(true));
  it('backend se može izričito isključiti za offline način i testove', () =>
    expect(resolveSupabaseConfig({ VITE_SUPABASE_DISABLED: 'true' }, project).configured).toBe(
      false,
    ));
  it('djelomična konfiguracija ne spaja dva projekta', () => {
    const result = resolveSupabaseConfig(
      { VITE_SUPABASE_URL: 'https://other.supabase.co' },
      project,
    );
    expect(result.configured).toBe(false);
    expect(result.key).toBe('');
  });
  it('podržava stariji naziv javnog anon ključa', () =>
    expect(
      resolveSupabaseConfig(
        { VITE_SUPABASE_URL: project.url, VITE_SUPABASE_ANON_KEY: 'anon-example' },
        project,
      ).configured,
    ).toBe(true));
  it('odbija serverski secret ključ u pregledniku', () =>
    expect(
      resolveSupabaseConfig(
        {
          VITE_SUPABASE_URL: project.url,
          VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_not_for_the_browser',
        },
        project,
      ).configured,
    ).toBe(false));
  it('odbija JWT s privilegiranom ulogom service_role', () => {
    const jwt = 'header.' + btoa(JSON.stringify({ role: 'service_role' })) + '.signature';
    expect(
      resolveSupabaseConfig(
        { VITE_SUPABASE_URL: project.url, VITE_SUPABASE_PUBLISHABLE_KEY: jwt },
        project,
      ).configured,
    ).toBe(false);
  });
  it('neispravan URL ne ruši inicijalizaciju aplikacije', () =>
    expect(
      resolveSupabaseConfig(
        { VITE_SUPABASE_URL: 'nije-url', VITE_SUPABASE_PUBLISHABLE_KEY: 'public' },
        project,
      ).configured,
    ).toBe(false));
});
