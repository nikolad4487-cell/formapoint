import { WorkspaceIllustration, BrandBenefit } from '../components/brand';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Zap,
  ChartNoAxesColumnIncreasing,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Logo, Unavailable } from '../components/common';
import { configured, requireDb } from '../lib/supabase';
const schema = z.object({
  email: z.string(),
  password: z.string(),
  confirm: z.string(),
  first: z.string(),
  last: z.string(),
  phone: z.string(),
  terms: z.boolean(),
  marketing: z.boolean(),
});
type Fields = z.infer<typeof schema>;
export function AuthPage({
  mode = 'login',
}: {
  mode?: 'login' | 'register' | 'forgot' | 'reset' | 'confirm';
}) {
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const registerMode = mode === 'register';
  const passwordMode = ['login', 'register', 'reset'].includes(mode);
  const {
    register,
    handleSubmit,
    setError: fieldError,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
      confirm: '',
      first: '',
      last: '',
      phone: '',
      terms: false,
      marketing: false,
    },
  });
  const title = {
    login: 'Dobro došli natrag.',
    register: 'Vaše ideje počinju ovdje.',
    forgot: 'Zaboravili ste lozinku?',
    reset: 'Postavite novu lozinku.',
    confirm: 'Provjerite svoju e-poštu.',
  }[mode];
  async function submit(v: Fields) {
    setError('');
    setNotice('');
    if (mode !== 'reset' && !z.email().safeParse(v.email).success) {
      fieldError('email', { message: 'Unesite ispravnu e-mail adresu.' });
      return;
    }
    if (passwordMode && v.password.length < (mode === 'login' ? 1 : 12)) {
      fieldError('password', {
        message: 'Unesite lozinku; nova lozinka treba imati najmanje 12 znakova.',
      });
      return;
    }
    if ((registerMode || mode === 'reset') && v.password !== v.confirm) {
      fieldError('confirm', { message: 'Lozinke se ne podudaraju.' });
      return;
    }
    if (registerMode && (!v.first.trim() || !v.last.trim() || !v.terms)) {
      setError('Unesite ime i prezime te prihvatite uvjete korištenja.');
      return;
    }
    try {
      const auth = requireDb().auth;
      if (mode === 'login') {
        const { error } = await auth.signInWithPassword({ email: v.email, password: v.password });
        if (error) throw error;
        const from = location.state?.from;
        navigate(typeof from === 'string' && from.startsWith('/app') ? from : '/app');
      }
      if (registerMode) {
        const { error } = await auth.signUp({
          email: v.email,
          password: v.password,
          options: {
            emailRedirectTo: `${window.location.origin}/potvrda-emaila`,
            data: {
              first_name: v.first.trim(),
              last_name: v.last.trim(),
              phone: v.phone.trim() || null,
              marketing_consent: v.marketing,
              terms_accepted_at: new Date().toISOString(),
            },
          },
        });
        if (error) throw error;
        navigate('/potvrda-emaila');
      }
      if (mode === 'forgot') {
        const { error } = await auth.resetPasswordForEmail(v.email, {
          redirectTo: `${window.location.origin}/reset-lozinke`,
        });
        if (error) throw error;
        setNotice('Ako račun postoji, poslana je poveznica za promjenu lozinke.');
      }
      if (mode === 'reset') {
        const { error } = await auth.updateUser({ password: v.password });
        if (error) throw error;
        setNotice('Lozinka je promijenjena. Možete nastaviti u svoj radni prostor.');
      }
    } catch {
      setError(
        'Zahtjev nije uspio. Provjerite podatke ili poveznicu i pokušajte ponovno. Previše pokušaja može privremeno ograničiti pristup.',
      );
    }
  }
  return (
    <div className="container auth-layout section">
      <aside className="auth-aside">
        <Logo />
        <h2>
          Digitalne usluge
          <br />
          <span>na jednom mjestu</span>
        </h2>
        <p>
          Profesionalni dokumenti, prezentacije i digitalna administracija. Sve narudžbe i dogovori
          u jednom radnom prostoru.
        </p>
        <div className="auth-benefits">
          <BrandBenefit icon={Zap} title="Brza i jednostavna narudžba" color="violet">
            Opišite zadatak i dogovorite izradu u nekoliko koraka.
          </BrandBenefit>
          <BrandBenefit icon={ShieldCheck} title="Privatni dokumenti" color="green">
            Vaše datoteke dostupne su ovlaštenim osobama.
          </BrandBenefit>
          <BrandBenefit icon={ChartNoAxesColumnIncreasing} title="Sve na jednom mjestu">
            Organizacija, komunikacija i praćenje narudžbi.
          </BrandBenefit>
        </div>
        <WorkspaceIllustration compact />
      </aside>
      <section className="auth-form">
        <div className="auth-mobile-logo">
          <Logo />
        </div>
        {(mode === 'login' || registerMode) && (
          <nav className="auth-tabs" aria-label="Korisnički račun">
            <Link
              aria-current={mode === 'login' ? 'page' : undefined}
              className={mode === 'login' ? 'active' : ''}
              to="/prijava"
            >
              Prijava
            </Link>
            <Link
              aria-current={registerMode ? 'page' : undefined}
              className={registerMode ? 'active' : ''}
              to="/registracija"
            >
              Registracija
            </Link>
          </nav>
        )}
        <h1>{title}</h1>
        <p>
          {registerMode
            ? 'Otvorite račun i pojednostavite svoje digitalne zadatke.'
            : mode === 'login'
              ? 'Prijavite se u svoj FormaPoint radni prostor.'
              : 'Nastavite sigurno upravljati svojim računom.'}
        </p>
        {!configured && <Unavailable />}
        {mode === 'confirm' ? (
          <>
            <div className="notice">
              <CheckCircle2 />
              <p>
                Otvorite poveznicu za potvrdu poslanu e-poštom. Ako poruka nije stigla, provjerite
                neželjenu poštu.
              </p>
            </div>
            <Button asChild>
              <Link to="/prijava">Na prijavu</Link>
            </Button>
          </>
        ) : (
          <form onSubmit={handleSubmit(submit)} noValidate>
            {registerMode && (
              <div className="form-row">
                <label>
                  Ime
                  <input autoComplete="given-name" {...register('first')} />
                </label>
                <label>
                  Prezime
                  <input autoComplete="family-name" {...register('last')} />
                </label>
              </div>
            )}
            {mode !== 'reset' && (
              <label>
                E-mail adresa
                <input
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  aria-invalid={!!errors.email}
                />
                {errors.email && <span className="field-error">{errors.email.message}</span>}
              </label>
            )}
            {passwordMode && (
              <label>
                Lozinka
                <div className="password-field">
                  <input
                    type={show ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    aria-label={show ? 'Sakrij lozinku' : 'Prikaži lozinku'}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <span className="field-error">{errors.password.message}</span>}
              </label>
            )}
            {(registerMode || mode === 'reset') && (
              <label>
                Potvrda lozinke
                <input type="password" autoComplete="new-password" {...register('confirm')} />
                {errors.confirm && <span className="field-error">{errors.confirm.message}</span>}
              </label>
            )}
            {registerMode && (
              <>
                <label>
                  Telefon (neobvezno)
                  <input type="tel" autoComplete="tel" {...register('phone')} />
                </label>
                <label className="checkbox">
                  <input type="checkbox" {...register('terms')} />
                  <span>
                    Prihvaćam <Link to="/uvjeti-koristenja">uvjete korištenja</Link> i upoznat/a sam
                    s <Link to="/pravila-privatnosti">pravilima privatnosti</Link>.
                  </span>
                </label>
                <label className="checkbox">
                  <input type="checkbox" {...register('marketing')} />
                  <span>Želim primati novosti i ponude (neobvezno).</span>
                </label>
              </>
            )}
            {mode === 'login' && (
              <Link className="forgot-link" to="/zaboravljena-lozinka">
                Zaboravljena lozinka?
              </Link>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
            <Button disabled={!configured || isSubmitting} type="submit">
              {isSubmitting
                ? 'Slanje…'
                : {
                    login: 'Prijavi se',
                    register: 'Kreiraj račun',
                    forgot: 'Pošalji poveznicu',
                    reset: 'Spremi lozinku',
                    confirm: 'Nastavi',
                  }[mode]}
              <ArrowRight size={17} />
            </Button>
            {mode === 'login' ? (
              <p className="auth-switch">
                Nemate račun? <Link to="/registracija">Registrirajte se</Link>
              </p>
            ) : (
              <p className="auth-switch">
                Već imate račun? <Link to="/prijava">Prijavite se</Link>
              </p>
            )}
          </form>
        )}
      </section>
    </div>
  );
}
