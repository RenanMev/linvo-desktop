import * as React from "react";
import { Eye, EyeOff, Minus, X, type LucideIcon } from "lucide-react";

import { LinvoLogo } from "@/components/linvo-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hideAllWindows } from "@/lib/app-windows";
import { cn } from "@/lib/utils";

type AuthLayoutProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="window-shell relative flex h-full w-full overflow-hidden rounded-premium">
      <AuthTitleBar />
      <AuthBrandPanel />
      <div className="relative flex flex-1 flex-col justify-center overflow-hidden px-10 py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full border border-hairline"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 -left-10 size-40 rounded-full border border-hairline"
        />
        <div className="relative mx-auto w-full max-w-[22rem]">
          <div className="mb-8 space-y-1.5">
            <h1 className="font-editorial text-[1.9rem] font-medium tracking-tight">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
          {footer && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              {footer}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthTitleBar() {
  return (
    <div
      data-tauri-drag-region
      className="absolute inset-x-0 top-0 z-20 flex h-10 items-center justify-end px-2"
    >
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void hideAllWindows()}
          title="Minimizar"
        >
          <Minus />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void hideAllWindows()}
          title="Fechar"
          className="hover:bg-destructive hover:text-white"
        >
          <X />
        </Button>
      </div>
    </div>
  );
}

function AuthBrandPanel() {
  return (
    <aside className="relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden bg-foreground p-10 text-background sm:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18] [background:radial-gradient(120%_80%_at_15%_0%,currentColor,transparent_55%),radial-gradient(90%_70%_at_100%_100%,currentColor,transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-24 size-72 rounded-full border border-black/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -bottom-10 size-40 rounded-full border border-black/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-2 bottom-2 size-16 rounded-full border border-black/10"
      />
      <div className="relative flex items-center gap-2.5">
        <LinvoLogo className="size-8 invert dark:invert-0" />
        <span className="text-lg font-semibold tracking-tight">Linvo Desktop</span>
      </div>

      <div className="relative space-y-4">
        <h2 className="font-editorial text-[1.9rem] font-medium leading-tight tracking-tight">
          Seu assistente de desktop, sempre à mão.
        </h2>
        <p className="max-w-[24ch] text-sm leading-relaxed text-background/60">
          Acesse suas conversas, comandos e configurações em uma janela leve e
          elegante.
        </p>
      </div>

      <p className="relative font-technical text-[10px] tracking-wide text-background/45">
        © {new Date().getFullYear()} Linvo
      </p>
    </aside>
  );
}

type AuthFieldProps = {
  id: string;
  label: string;
  icon?: LucideIcon;
  password?: boolean;
} & Omit<React.ComponentProps<"input">, "id">;

export function AuthField({
  id,
  label,
  icon: Icon,
  password = false,
  className,
  type,
  ...props
}: AuthFieldProps) {
  const [visible, setVisible] = React.useState(false);
  const resolvedType = password ? (visible ? "text" : "password") : type;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          id={id}
          type={resolvedType}
          className={cn(
            "h-11",
            Icon && "pl-9",
            password && "pr-10",
            className,
          )}
          {...props}
        />
        {password && (
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

export function AuthNotice({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
      {message}
    </p>
  );
}
