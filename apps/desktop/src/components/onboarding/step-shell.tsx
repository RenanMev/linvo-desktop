import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho da etapa: título editorial e uma linha de apoio, centrados.
 * Qual etapa é já está dito pelo indicador de progresso acima — aqui não se
 * repete rótulo nem numeração.
 */
export function StepHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="mb-7 shrink-0 space-y-2 text-center">
      <h1 className="font-display text-[1.6rem] leading-tight font-semibold tracking-tight text-balance">
        {title}
      </h1>
      <p className="text-sm leading-relaxed text-text-secondary text-balance">
        {description}
      </p>
    </header>
  );
}

/** Ação primária da etapa: uma só, largura cheia, igual à do login. */
export function StepPrimary({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      size="lg"
      className={cn("w-full", className)}
      {...props}
    />
  );
}

/** Ação discreta (voltar, pular): texto, nunca competindo com a primária. */
export function StepLink({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-auto px-1 py-0.5 text-[13px] font-normal text-text-tertiary hover:bg-transparent hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Rodapé da etapa: primária em cima, ações discretas centradas embaixo. */
export function StepActions({
  links,
  children,
}: {
  links?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-7 shrink-0 space-y-2.5">
      {children}
      {links ? (
        <div className="flex items-center justify-center gap-5">{links}</div>
      ) : null}
    </div>
  );
}
