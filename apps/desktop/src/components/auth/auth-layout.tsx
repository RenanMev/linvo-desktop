import * as React from "react";
import { Eye, EyeOff, Minus, X } from "lucide-react";

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
    <div className="window-shell relative flex h-full w-full flex-col overflow-hidden rounded-premium bg-background">
      <AuthTitleBar />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex min-h-full flex-col items-center justify-center px-10 py-14">
          <div className="w-full max-w-[22rem]">
            <div className="mb-8 flex flex-col items-center text-center">
              <LinvoLogo className="mb-6 size-10 dark:invert" />
              <h1 className="font-editorial text-[1.9rem] font-medium tracking-tight text-balance">
                {title}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground text-balance">
                {description}
              </p>
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

type AuthFieldProps = {
  id: string;
  label: string;
  password?: boolean;
} & Omit<React.ComponentProps<"input">, "id">;

export function AuthField({
  id,
  label,
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
        <Input
          id={id}
          type={resolvedType}
          className={cn("h-11", password && "pr-10", className)}
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
