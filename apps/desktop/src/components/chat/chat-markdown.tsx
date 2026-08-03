import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { openUrl } from "@tauri-apps/plugin-opener";

import { cn } from "@/lib/utils";

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

export function isAllowedExternalHref(href: string): boolean {
  try {
    return ALLOWED_EXTERNAL_PROTOCOLS.has(new URL(href).protocol);
  } catch {
    return false;
  }
}

type ChatMarkdownProps = {
  content: string;
  className?: string;
  /**
   * Saída de LLM: corpo serifado editorial (Newsreader 17px / leading-relaxed).
   * Fora disso o markdown segue a tipografia de interface (Inter).
   */
  editorial?: boolean;
};

export function ChatMarkdown({
  content,
  className,
  editorial = false,
}: ChatMarkdownProps) {
  return (
    <div
      className={cn(
        "chat-markdown break-words",
        editorial
          ? "editorial-body font-serif [&_em]:italic [&_h1]:font-serif [&_h2]:font-serif [&_h3]:font-serif"
          : "text-sm leading-relaxed",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        editorial
          ? "[&_p]:my-3.5 [&_ul]:my-3.5 [&_ol]:my-3.5 [&_li]:my-1"
          : "[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_strong]:font-semibold",
        "[&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-white/30 hover:[&_a]:decoration-white",
        editorial
          ? "[&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:tracking-tight"
          : "[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold",
        editorial
          ? "[&_h2]:mb-2.5 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight"
          : "[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold",
        editorial
          ? "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold"
          : "[&_h3]:mb-1.5 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-hairline-strong [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-foreground/65",
        "[&_hr]:my-5 [&_hr]:border-hairline",
        // Dados técnicos sempre em mono, nunca em serifada
        "[&_code]:font-technical [&_pre]:font-technical [&_table]:font-technical [&_table]:text-[13px]",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, title }) => {
            if (!href || !isAllowedExternalHref(href)) {
              return <span title={title}>{children}</span>;
            }

            return (
              <a
                href={href}
                title={title}
                rel="noopener noreferrer"
                onClick={(event) => {
                  event.preventDefault();
                  void openUrl(href).catch(() => undefined);
                }}
              >
                {children}
              </a>
            );
          },
          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto rounded-premium border border-hairline bg-surface-raise-1 p-3.5 font-technical text-xs leading-relaxed shadow-inner-light">
              {children}
            </pre>
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const isBlock = Boolean(codeClassName);
            if (isBlock) {
              return (
                <code className={cn("font-technical", codeClassName)} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded-md border border-hairline bg-surface-raise-2 px-1.5 py-0.5 font-technical text-[0.82em]"
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
