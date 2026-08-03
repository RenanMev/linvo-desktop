import { getToolLabel, type ForceTool } from "@linvo/shared";
import { Globe, Library, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FORCE_TOOLS: Array<{
  id: ForceTool;
  icon: typeof Globe;
}> = [
  { id: "web_search", icon: Globe },
  { id: "search_knowledge", icon: Library },
];

type ChatToolsMenuProps = {
  value: ForceTool | null;
  onChange: (tool: ForceTool | null) => void;
  disabled?: boolean;
};

export function ChatToolsMenu({
  value,
  onChange,
  disabled = false,
}: ChatToolsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="gap-1.5 text-muted-foreground"
            title="Tools"
          />
        }
      >
        <Wrench className="size-3.5" />
        Tools
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        {FORCE_TOOLS.map(({ id, icon: Icon }) => (
          <DropdownMenuItem
            key={id}
            onClick={() => onChange(value === id ? null : id)}
          >
            <Icon />
            {getToolLabel(id)}
            {value === id ? " ✓" : ""}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
