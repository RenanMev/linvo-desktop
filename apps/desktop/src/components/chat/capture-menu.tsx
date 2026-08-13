import {
  AppWindow,
  Crosshair,
  Monitor,
  SquareDashedMousePointer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CaptureMenuProps = {
  disabled?: boolean;
  /** O painel flutuante tem barra de ações mais baixa que o chat do painel. */
  size?: "icon-sm" | "icon-xs";
  side?: "top" | "bottom";
  onPickSource: () => void;
  onMagneticCapture: () => void;
  onSystemPicker: () => void;
};

/**
 * Gatilho das três formas de anexar contexto visual. Vive fora do `ChatInput`
 * porque o chat flutuante oferece exatamente as mesmas opções — inclusive o
 * seletor nativo listado pelo Rust (`capture_list_sources`).
 */
export function CaptureMenu({
  disabled = false,
  size = "icon-sm",
  side = "top",
  onPickSource,
  onMagneticCapture,
  onSystemPicker,
}: CaptureMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size={size}
            disabled={disabled}
            title="Capturar contexto visual"
            aria-label="Capturar contexto visual"
            className="text-muted-foreground"
          />
        }
      >
        <SquareDashedMousePointer />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={side}>
        <DropdownMenuItem onClick={onPickSource}>
          <AppWindow />
          Escolher janela ou tela
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMagneticCapture}>
          <Crosshair />
          Recorte magnético
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSystemPicker}>
          <Monitor />
          Seletor do sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
