import {

  MessageSquare,

  MessageSquarePlus,

  Search,

  Settings,

  Sparkles,

  User,

} from "lucide-react";

import { NavLink, useLocation } from "react-router-dom";



import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { useConversations } from "@/context/chat-conversations-context";

import { cn } from "@/lib/utils";



const mainNav = [

  { to: "/chat", label: "Chat", icon: MessageSquare },

  { to: "/settings/general", label: "Configurações", icon: Settings },

] as const;



const settingsNav = [

  { to: "/settings/general", label: "Geral", icon: Sparkles },

  { to: "/settings/account", label: "Conta", icon: User },

] as const;



function navClassName({ isActive }: { isActive: boolean }) {

  return cn(

    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",

    isActive

      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"

      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",

  );

}



function formatConversationDate(isoDate: string): string {

  const date = new Date(isoDate);

  return date.toLocaleDateString("pt-BR", {

    day: "2-digit",

    month: "short",

  });

}



export function PanelSidebar() {

  const location = useLocation();

  const inSettings = location.pathname.startsWith("/settings");

  const searchPlaceholder = inSettings

    ? "Buscar configurações"

    : "Buscar conversas";

  const {

    conversations,

    activeId,

    isLoading,

    createConversation,

    selectConversation,

  } = useConversations();



  return (

    <aside className="flex h-full min-h-0 w-60 shrink-0 flex-col overflow-hidden border-r border-border/60 bg-sidebar text-sidebar-foreground">

      <div className="flex items-center gap-3 px-4 py-4">

        <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">

          <Sparkles className="size-4" />

        </span>

        <div className="min-w-0">

          <p className="truncate text-sm font-semibold leading-tight">Linvo Desktop</p>

          <p className="truncate text-xs text-muted-foreground">

            {inSettings ? "Configurações" : "Chat"}

          </p>

        </div>

      </div>



      <div className="px-3 pb-3">

        <div className="relative">

          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input

            placeholder={searchPlaceholder}

            className="h-8 border-transparent bg-sidebar-accent pl-8 text-sm shadow-none"

          />

        </div>

      </div>



      <nav className="space-y-0.5 px-3" aria-label="Navegação principal">

        {mainNav.map(({ to, label, icon: Icon }) => (

          <NavLink key={to} to={to} className={navClassName}>

            <Icon className="size-4 shrink-0" />

            {label}

          </NavLink>

        ))}

      </nav>



      {inSettings ? (

        <nav

          className="mt-4 space-y-0.5 border-t border-sidebar-border px-3 pt-4"

          aria-label="Seções de configurações"

        >

          <p className="mb-2 px-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">

            Seções

          </p>

          {settingsNav.map(({ to, label, icon: Icon }) => (

            <NavLink key={to} to={to} className={navClassName}>

              <Icon className="size-4 shrink-0" />

              {label}

            </NavLink>

          ))}

        </nav>

      ) : (

        <div className="mt-2 flex min-h-0 flex-1 flex-col px-3 py-2">

          <Button

            type="button"

            variant="outline"

            size="sm"

            className="mb-3 w-full justify-start gap-2"

            onClick={() => void createConversation()}

          >

            <MessageSquarePlus className="size-4" />

            Nova conversa

          </Button>



          <nav
            className="scrollbar-elegant scrollbar-sidebar min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1"
            aria-label="Conversas"
          >

            {isLoading ? (

              <p className="px-2.5 py-2 text-xs text-muted-foreground">

                Carregando conversas...

              </p>

            ) : conversations.length === 0 ? (

              <p className="px-2.5 py-2 text-xs text-muted-foreground">

                Nenhuma conversa ainda

              </p>

            ) : (

              conversations.map((conversation) => (

                <button

                  key={conversation.id}

                  type="button"

                  onClick={() => selectConversation(conversation.id)}

                  className={cn(

                    "flex w-full flex-col rounded-md px-2.5 py-2 text-left text-sm transition-colors",

                    activeId === conversation.id

                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"

                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",

                  )}

                >

                  <span className="truncate">{conversation.title}</span>

                  <span className="text-xs text-muted-foreground">

                    {formatConversationDate(conversation.updatedAt)}

                  </span>

                </button>

              ))

            )}

          </nav>

        </div>

      )}

    </aside>

  );

}


