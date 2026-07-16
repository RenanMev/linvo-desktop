import { Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

type ChatToolbarProps = {
  title: string;
};

export function ChatToolbar({ title }: ChatToolbarProps) {
  const navigate = useNavigate();

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
      <p className="min-w-0 truncate text-sm font-medium">{title}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 gap-2 rounded-full"
        onClick={() => navigate("/settings/general")}
      >
        Configurações
        <Settings className="size-3.5" />
      </Button>
    </div>
  );
}
