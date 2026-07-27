import { cn } from "@/lib/utils";

type LinvoLogoProps = {
  className?: string;
  title?: string;
};

export function LinvoLogo({ className, title = "Linvo" }: LinvoLogoProps) {
  return (
    <img
      src="/linvo-logo.png"
      alt={title}
      draggable={false}
      className={cn("select-none object-contain", className)}
    />
  );
}
