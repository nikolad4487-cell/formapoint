import * as Dialog from '@radix-ui/react-dialog';
import { Bot, MessageCircle, Send, X, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import { requireDb } from '../lib/supabase';
import './ai-assistant.css';

type Message = { role: 'user' | 'assistant'; content: string };
const welcome = 'Pozdrav! Ja sam FormaPoint AI asistent. Kako vam mogu pomoći danas?';
export function AIAssistant() {
  const { session } = useAuth();
  return (
    <AssistantChat
      key={session?.user.id || 'visitor'}
      storageKey={`fp-ai:${session?.user.id || 'visitor'}`}
    />
  );
}
function AssistantChat({ storageKey }: { storageKey: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
      return Array.isArray(stored)
        ? stored
            .filter(
              (m) =>
                ['user', 'assistant'].includes(m?.role) &&
                typeof m.content === 'string' &&
                m.content.length <= 6000,
            )
            .slice(-20)
        : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      /* A full/disabled browser store must not break chat. */
    }
  }, [messages, storageKey]);
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages, busy, open, error]);
  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: Message[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next.slice(-20));
    setInput('');
    setBusy(true);
    setError('');
    const controller = new AbortController();
    request.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 35000);
    try {
      const history = next.slice(-11).map((m) => ({ ...m, content: m.content.slice(0, 1500) }));
      while (history[0]?.role === 'assistant') history.shift();
      const { data, error: failed } = await requireDb().functions.invoke('ai-assistant', {
        body: { messages: history },
        signal: controller.signal,
      });
      if (failed || !data?.answer || typeof data.answer !== 'string') {
        let detail =
          'AI asistent trenutačno nije dostupan. Pokušajte ponovno ili kontaktirajte podršku.';
        if (failed?.context instanceof Response) {
          try {
            const body = await failed.context.json();
            if (typeof body.error === 'string') detail = body.error;
          } catch {
            /* Keep the friendly default. */
          }
        }
        throw new Error(detail);
      }
      if (!controller.signal.aborted)
        setMessages(
          (current) =>
            [...current, { role: 'assistant', content: data.answer.slice(0, 6000) }].slice(
              -20,
            ) as Message[],
        );
    } catch (err) {
      if (request.current === controller)
        setError(
          err instanceof Error && !controller.signal.aborted
            ? err.message
            : 'Odgovor nije stigao na vrijeme. Pokušajte ponovno.',
        );
    } finally {
      window.clearTimeout(timer);
      if (request.current === controller) {
        setBusy(false);
        request.current = null;
      }
    }
  }
  function clear() {
    request.current?.abort();
    request.current = null;
    setMessages([]);
    setError('');
    setBusy(false);
    setInput('');
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
      <Dialog.Trigger asChild>
        <button
          className="ai-toggle"
          aria-label="Otvori FormaPoint AI asistenta"
          title="FormaPoint AI asistent"
        >
          <MessageCircle size={28} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          className="ai-panel"
          aria-describedby="ai-description"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <header className="ai-heading">
            <Bot size={24} />
            <div>
              <Dialog.Title>FormaPoint AI</Dialog.Title>
              <span>Vaš pomagač na platformi</span>
            </div>
            <button
              type="button"
              className="ai-icon-button"
              aria-label="Novi razgovor"
              title="Novi razgovor"
              onClick={clear}
            >
              <RotateCcw size={18} />
            </button>
            <Dialog.Close className="ai-icon-button" aria-label="Zatvori AI asistenta">
              <X size={23} />
            </Dialog.Close>
          </header>
          <Dialog.Description id="ai-description" className="sr-only">
            Pitajte o uslugama, naručivanju i plaćanju. Odgovore generira Google Gemini.
          </Dialog.Description>
          <div
            className="ai-messages"
            role="log"
            aria-label="Razgovor s AI asistentom"
            aria-live="polite"
            aria-relevant="additions text"
          >
            <p className="ai-bubble ai-assistant">{welcome}</p>
            {messages.map((message, index) => (
              <p key={index} className={`ai-bubble ai-${message.role}`}>
                <span className="sr-only">{message.role === 'user' ? 'Vi' : 'AI asistent'}: </span>
                {message.content}
              </p>
            ))}
            {!messages.length && (
              <div className="ai-suggestions">
                {[
                  'Kako naručiti kao gost?',
                  'Kako funkcionira plaćanje 50/50?',
                  'Kada mogu preuzeti rad?',
                ].map((q) => (
                  <button key={q} onClick={() => void send(q)} disabled={busy}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            {busy && (
              <div className="ai-typing" role="status" aria-label="Asistent priprema odgovor">
                <span />
                <span />
                <span />
              </div>
            )}
            {error && (
              <div className="ai-error" role="alert">
                <p>{error}</p>
                <button
                  disabled={busy}
                  onClick={() => {
                    const last = messages.filter((m) => m.role === 'user').at(-1);
                    if (last) {
                      setMessages(messages.slice(0, -1));
                      setInput(last.content);
                      setError('');
                    }
                  }}
                >
                  Uredi pitanje i pokušaj ponovno
                </button>
              </div>
            )}
            <div ref={end} />
          </div>
          <nav className="ai-links" aria-label="Pomoć i podrška">
            <Link to="/faq" onClick={() => setOpen(false)}>
              Česta pitanja
            </Link>
            <Link to="/kontakt" onClick={() => setOpen(false)}>
              Kontaktiraj podršku
            </Link>
          </nav>
          <form
            className="ai-compose"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <label className="sr-only" htmlFor="ai-question">
              Pitanje za AI asistenta
            </label>
            <textarea
              id="ai-question"
              rows={1}
              maxLength={1500}
              value={input}
              placeholder="Postavite pitanje…"
              disabled={busy}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send(input);
                }
              }}
            />
            <button type="submit" aria-label="Pošalji pitanje" disabled={busy || !input.trim()}>
              <Send size={21} />
            </button>
          </form>
          <p className="ai-privacy">
            Poruke obrađuje Google Gemini. Ne šaljite lozinke ni podatke kartice.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
