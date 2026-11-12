import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'soft' | 'danger'; loading?: boolean; size?: 'md' | 'lg' | 'sm' };

export function Btn({ variant = 'primary', loading, size = 'md', className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,opacity,background-color] duration-200 active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none select-none',
        size === 'lg' && 'h-13 px-6 text-[15px] min-h-[52px]',
        size === 'md' && 'h-11 px-5 text-sm',
        size === 'sm' && 'h-9 px-3.5 text-[13px]',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-[hsl(22_100%_57%)]',
        variant === 'soft' && 'bg-secondary text-foreground hover:bg-[hsl(24_6%_16%)]',
        variant === 'ghost' && 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
        variant === 'danger' && 'bg-destructive/15 text-destructive hover:bg-destructive/25',
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      {children}
      {error ? <span className="block text-[12.5px] text-destructive">{error}</span> : hint ? <span className="block text-[12.5px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        'h-12 w-full rounded-xl border border-input bg-[hsl(24_7%_7%)] px-4 text-[15px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/70',
        className,
      )}
    />
  );
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextInput {...props} type={show ? 'text' : 'password'} autoComplete={props.autoComplete ?? 'current-password'} className="pr-12" />
      <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-[22px] border border-card-border bg-card', className)}>{children}</div>;
}

export function StagenetBadge({ className }: { className?: string }) {
  return (
    <span data-testid="badge-stagenet" title="Test network. Coins have no value." className={cn('inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      Stagenet
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[hsl(24_10%_3%/0.75)] backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-label={title}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className={cn('relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[26px] border border-popover-border bg-popover p-6 sm:rounded-[26px]', wide ? 'sm:max-w-lg' : 'sm:max-w-md')}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close" data-testid="button-close-modal">
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toggle({ checked, onChange, testId }: { checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-[hsl(24_6%_20%)]')}
    >
      <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 35 }} className={cn('absolute top-1 h-5 w-5 rounded-full bg-[hsl(30_20%_96%)]', checked ? 'right-1' : 'left-1')} />
    </button>
  );
}

export function ErrorLine({ msg }: { msg: string | null | undefined }) {
  if (!msg) return null;
  return <p className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive" data-testid="text-error">{msg}</p>;
}

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
