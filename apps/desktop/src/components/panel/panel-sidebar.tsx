import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Archive,
  Bell,
  Building2,
  Boxes,
  ChevronDown,
  CreditCard,
  FileText,
  Keyboard,
  Layers,
  LibraryBig,
  LifeBuoy,
  MessageSquarePlus,
  Palette,
  PanelLeft,
  PanelLeftClose,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router";

import { LinvoLogo } from "@/components/linvo-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useConversations } from "@/context/chat-conversations-context";
import { useWorkspace } from "@/context/workspace-context";
import type { PanelSession } from "@/hooks/use-panel-session";
import { useWorkspaceFileBlob } from "@/hooks/use-workspace-file-blob";
import { resolveWorkspaceImageUrl } from "@/lib/workspace/workspace-api";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "linvo.panel.sidebar-collapsed";

type NavItem = {
  label: string;
  icon: LucideIcon;
  to?: string;
  soon?: boolean;
  matchPrefix?: boolean;
};

type NavGroup = {
  id: string;
  label?: string;
  items: NavItem[];
};

const settingsGroups: NavGroup[] = [
  {
    id: "geral",
    items: [{ label: "Geral", icon: Settings, to: "/settings/general" }],
  },
  {
    id: "preferencias",
    label: "Preferências",
    items: [
      { label: "Aparência", icon: Palette, to: "/settings/appearance" },
      { label: "Atalhos", icon: Keyboard, soon: true },
      { label: "Notificações", icon: Bell, soon: true },
    ],
  },
  {
    id: "conta",
    label: "Conta",
    items: [
      { label: "Conta", icon: User, to: "/settings/account" },
      {
        label: "Workspace",
        icon: Building2,
        to: "/settings/workspace",
        matchPrefix: true,
      },
      { label: "Plano e uso", icon: CreditCard, soon: true },
    ],
  },
  {
    id: "avancado",
    label: "Avançado",
    items: [
      { label: "Modelos", icon: Boxes, soon: true },
      { label: "Ferramentas & MCPs", icon: Layers, soon: true },
      { label: "Privacidade", icon: ShieldCheck, soon: true },
    ],
  },
];

const chatExploreItems: NavItem[] = [
  { label: "Documentos", icon: FileText, to: "/documents" },
  { label: "Arquivadas", icon: Archive, soon: true },
  { label: "Biblioteca", icon: LibraryBig, soon: true },
];

const sidebarSectionX = "px-3";
const sidebarHeaderY = "py-3";
const sidebarBlockBottom = "pb-3";

function formatConversationDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function matchesQuery(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

function accountInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function readCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

const navRowBase =
  "flex w-full items-center gap-2.5 rounded-full px-2.5 py-1.5 text-xs transition-all duration-150";
const navRowIdle =
  "text-sidebar-foreground/70 [&_svg]:opacity-50 hover:bg-surface-hover hover:text-sidebar-foreground hover:[&_svg]:opacity-80";
const navRowActive =
  "nav-pill-active font-medium [&_svg]:opacity-100";

const collapsedIconBase =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-all duration-150";
const collapsedIconIdle =
  "text-sidebar-foreground/70 [&_svg]:opacity-50 hover:bg-surface-hover hover:text-sidebar-foreground hover:[&_svg]:opacity-90";
const navIcon = "size-4 shrink-0";

function SidebarNavRow({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  if (item.soon || !item.to) {
    return (
      <div
        className={cn(
          navRowBase,
          "cursor-default justify-between text-sidebar-foreground/35 [&_svg]:opacity-50",
        )}
        aria-disabled="true"
      >
        <span className="flex items-center gap-2.5">
          <Icon className={navIcon} />
          {item.label}
        </span>
        <span className="rounded-full border border-hairline px-1.5 py-0.5 font-technical text-[9px] font-medium tracking-wide text-muted-foreground">
          Em breve
        </span>
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={!item.matchPrefix}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(navRowBase, isActive ? navRowActive : navRowIdle)
      }
    >
      <Icon className={navIcon} />
      {item.label}
    </NavLink>
  );
}

function CollapsedIconButton({
  title,
  icon: Icon,
  onClick,
  active = false,
  disabled = false,
  tabIndex,
}: {
  title: string;
  icon: LucideIcon;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  tabIndex: number;
}) {
  return (
    <button
      type="button"
      title={title}
      tabIndex={tabIndex}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        collapsedIconBase,
        active ? "nav-pill-active [&_svg]:opacity-100" : collapsedIconIdle,
        disabled && "cursor-default opacity-35 hover:bg-transparent",
      )}
    >
      <Icon className={navIcon} />
    </button>
  );
}

function CollapsedSettingsNavItem({
  item,
  tabIndex,
}: {
  item: NavItem;
  tabIndex: number;
}) {
  const Icon = item.icon;

  if (item.soon || !item.to) {
    return (
      <CollapsedIconButton
        title={item.label}
        icon={Icon}
        tabIndex={tabIndex}
        disabled
      />
    );
  }

  return (
    <NavLink
      to={item.to}
      end={!item.matchPrefix}
      tabIndex={tabIndex}
      title={item.label}
      className={({ isActive }) =>
        cn(
          collapsedIconBase,
          isActive ? "nav-pill-active [&_svg]:opacity-100" : collapsedIconIdle,
        )
      }
    >
      <Icon className={navIcon} />
    </NavLink>
  );
}

type PanelSidebarProps = {
  session: PanelSession;
};

export function PanelSidebar({ session }: PanelSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const inSettings = location.pathname.startsWith("/settings");
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const [searchQuery, setSearchQuery] = useState("");
  const {
    conversations,
    activeId,
    isLoading,
    createConversation,
    deleteConversation,
    selectConversation,
  } = useConversations();
  const { activeWorkspace, workspaces, selectWorkspace } = useWorkspace();
  const activeWorkspaceImageUrl = resolveWorkspaceImageUrl(
    activeWorkspace?.imageUrl,
  );
  const { blobUrl: activeWorkspaceImageSrc } = useWorkspaceFileBlob(
    activeWorkspaceImageUrl,
  );

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      return;
    }
  }, [collapsed]);

  useEffect(() => {
    setSearchQuery("");
  }, [inSettings]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) {
      return conversations;
    }
    return conversations.filter((conversation) =>
      matchesQuery(conversation.title, searchQuery),
    );
  }, [conversations, searchQuery]);

  const filteredSettingsGroups = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) {
      return settingsGroups;
    }
    return settingsGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => matchesQuery(item.label, query)),
      }))
      .filter((group) => group.items.length > 0);
  }, [searchQuery]);

  const resetSearch = () => setSearchQuery("");
  const toggleCollapsed = () => setCollapsed((current) => !current);
  const collapsedTabIndex = collapsed ? 0 : -1;
  const allSettingsItems = useMemo(
    () => settingsGroups.flatMap((group) => group.items),
    [],
  );

  return (
    <aside
      className={cn(
        "relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-hairline bg-surface-raise-1 text-sidebar-foreground",
        "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width]",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center gap-1 overflow-hidden px-1.5 py-2.5 transition-opacity duration-200",
          collapsed
            ? "z-10 opacity-100"
            : "pointer-events-none z-0 opacity-0",
        )}
        aria-hidden={!collapsed}
      >
        {inSettings ? (
          <>
            <button
              type="button"
              title={session.user.name}
              tabIndex={collapsedTabIndex}
              onClick={() => navigate("/settings/account")}
              className="grid size-8 shrink-0 place-items-center rounded-full border border-hairline bg-surface-raise-2 font-technical text-[10px] font-semibold text-sidebar-accent-foreground transition-opacity hover:opacity-90"
            >
              {accountInitials(session.user.name)}
            </button>
            <CollapsedIconButton
              title="Expandir sidebar"
              icon={PanelLeft}
              tabIndex={collapsedTabIndex}
              onClick={toggleCollapsed}
            />
            <div className="my-0.5 h-px w-6 shrink-0 bg-surface-raise-2" />
            <CollapsedIconButton
              title="Voltar ao chat"
              icon={ArrowLeft}
              tabIndex={collapsedTabIndex}
              onClick={() => navigate("/chat")}
            />
            <div className="mt-0.5 flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {allSettingsItems.map((item) => (
                <CollapsedSettingsNavItem
                  key={item.label}
                  item={item}
                  tabIndex={collapsedTabIndex}
                />
              ))}
            </div>
            <div className="my-0.5 h-px w-6 shrink-0 bg-surface-raise-2" />
            <CollapsedIconButton
              title="Central de ajuda"
              icon={LifeBuoy}
              tabIndex={collapsedTabIndex}
              disabled
            />
          </>
        ) : (
          <>
            <button
              type="button"
              title="Linvo"
              tabIndex={collapsedTabIndex}
              onClick={() => navigate("/chat")}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground transition-opacity hover:opacity-90"
            >
              <LinvoLogo className="size-4 invert dark:invert-0" />
            </button>
            <CollapsedIconButton
              title="Expandir sidebar"
              icon={PanelLeft}
              tabIndex={collapsedTabIndex}
              onClick={toggleCollapsed}
            />
            <div className="my-0.5 h-px w-6 shrink-0 bg-surface-raise-2" />
            <CollapsedIconButton
              title="Nova conversa"
              icon={MessageSquarePlus}
              tabIndex={collapsedTabIndex}
              onClick={() => void createConversation()}
            />
            <div className="mt-0.5 flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {!isLoading &&
                filteredConversations.slice(0, 8).map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    title={conversation.title}
                    tabIndex={collapsedTabIndex}
                    onClick={() => selectConversation(conversation.id)}
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full font-technical text-[10px] font-semibold transition-all duration-150",
                      activeId === conversation.id
                        ? "nav-pill-active"
                        : "text-muted-foreground hover:bg-surface-hover hover:text-sidebar-foreground",
                    )}
                  >
                    {conversation.title.trim().slice(0, 1).toUpperCase() ||
                      "C"}
                  </button>
                ))}
            </div>
            <div className="my-0.5 h-px w-6 shrink-0 bg-surface-raise-2" />
            {chatExploreItems.map((item) => (
              <CollapsedIconButton
                key={item.label}
                title={item.label}
                icon={item.icon}
                tabIndex={collapsedTabIndex}
                active={item.to != null && location.pathname === item.to}
                disabled={item.to == null}
                onClick={item.to ? () => navigate(item.to!) : undefined}
              />
            ))}
          </>
        )}
      </div>

      <div
        className={cn(
          "absolute inset-0 flex min-h-0 flex-col overflow-hidden transition-opacity duration-200",
          collapsed
            ? "pointer-events-none z-0 opacity-0"
            : "z-10 opacity-100",
        )}
        aria-hidden={collapsed}
      >
        {inSettings ? (
          <>
            <div
              className={cn(
                "flex items-center justify-between gap-2",
                sidebarSectionX,
                sidebarHeaderY,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-hairline bg-surface-raise-2 font-technical text-[10px] font-semibold text-sidebar-accent-foreground">
                  {accountInitials(session.user.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold leading-tight">
                    {session.user.name}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {session.user.email}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Recolher sidebar"
                onClick={toggleCollapsed}
                className="size-8 shrink-0 text-muted-foreground"
              >
                <PanelLeftClose className="size-3.5" />
              </Button>
            </div>

            <div className={cn(sidebarSectionX, sidebarBlockBottom)}>
              <button
                type="button"
                onClick={() => navigate("/chat")}
                className={cn(navRowBase, navRowIdle)}
              >
                <ArrowLeft className={navIcon} />
                Voltar ao chat
              </button>
            </div>

            <div className={cn(sidebarSectionX, sidebarBlockBottom)}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar configurações"
                  className="h-8 rounded-full border-hairline bg-surface-raise-1 pl-7 text-xs"
                />
              </div>
            </div>

            <nav
              className={cn(
                "scrollbar-elegant scrollbar-sidebar min-h-0 flex-1 space-y-5 overflow-y-auto pb-2",
                sidebarSectionX,
              )}
              aria-label="Seções de configurações"
            >
              {filteredSettingsGroups.length === 0 ? (
                <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                  Nenhuma configuração encontrada
                </p>
              ) : (
                filteredSettingsGroups.map((group) => (
                  <div key={group.id} className="space-y-0.5">
                    {group.label ? (
                      <p className="mb-1.5 px-2.5 font-technical text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {group.label}
                      </p>
                    ) : null}
                    {group.items.map((item) => (
                      <SidebarNavRow
                        key={item.label}
                        item={item}
                        onNavigate={resetSearch}
                      />
                    ))}
                  </div>
                ))
              )}
            </nav>

            <div
              className={cn(
                "border-t border-hairline py-3",
                sidebarSectionX,
              )}
            >
              <div
                className={cn(
                  navRowBase,
                  "cursor-default justify-between text-sidebar-foreground/45",
                )}
              >
                <span className="flex items-center gap-2">
                  <LifeBuoy className={navIcon} />
                  Central de ajuda
                </span>
                <span className="rounded-full border border-hairline px-1.5 py-0.5 font-technical text-[9px] font-medium tracking-wide text-muted-foreground">
                  Em breve
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className={cn(
                "flex items-center justify-between gap-2",
                sidebarSectionX,
                sidebarHeaderY,
              )}
            >
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full px-1 py-1 text-left transition-colors hover:bg-surface-hover"
                      title="Trocar workspace"
                    />
                  }
                >
                  <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-sidebar-primary text-[10px] font-bold text-sidebar-primary-foreground">
                    {activeWorkspaceImageSrc ? (
                      <img
                        src={activeWorkspaceImageSrc}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      (activeWorkspace?.name ?? "L").slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-none">
                    {activeWorkspace?.name ?? "Linvo"}
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-48">
                  {workspaces.map((workspace) => (
                    <DropdownMenuItem
                      key={workspace.id}
                      className="text-xs"
                      onClick={() => {
                        if (workspace.id !== activeWorkspace?.id) {
                          void selectWorkspace(workspace.id);
                        }
                      }}
                    >
                      {workspace.name}
                      {workspace.id === activeWorkspace?.id ? " · ativo" : ""}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    className="text-xs"
                    onClick={() => navigate("/settings/workspace")}
                  >
                    Gerenciar workspaces
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Recolher sidebar"
                onClick={toggleCollapsed}
                className="size-8 shrink-0 text-muted-foreground"
              >
                <PanelLeftClose className="size-3.5" />
              </Button>
            </div>

            <div className={cn(sidebarSectionX, sidebarBlockBottom)}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 w-full justify-start gap-2.5 rounded-full text-xs"
                onClick={() => void createConversation()}
              >
                <MessageSquarePlus className="size-4 opacity-70" />
                Nova conversa
              </Button>
            </div>

            <div className={cn(sidebarSectionX, sidebarBlockBottom)}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar conversas"
                  className="h-8 rounded-full border-hairline bg-surface-raise-1 pl-7 text-xs"
                />
              </div>
            </div>

            <div className={cn("flex min-h-0 flex-1 flex-col", sidebarSectionX)}>
              <p className="mb-1.5 px-2.5 font-technical text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Conversas
              </p>
              <nav
                className="scrollbar-elegant scrollbar-sidebar min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5"
                aria-label="Conversas"
              >
                {isLoading ? (
                  <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                    Carregando conversas...
                  </p>
                ) : filteredConversations.length === 0 ? (
                  <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                    {conversations.length === 0
                      ? "Nenhuma conversa ainda"
                      : "Nenhuma conversa encontrada"}
                  </p>
                ) : (
                  filteredConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={cn(
                        "group relative flex items-stretch rounded-xl transition-all duration-150",
                        activeId === conversation.id
                          ? "nav-pill-active font-medium"
                          : "text-sidebar-foreground/70 hover:bg-surface-hover hover:text-sidebar-foreground",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => selectConversation(conversation.id)}
                        className="flex min-w-0 flex-1 flex-col px-2 py-1.5 text-left text-xs"
                      >
                        <span className="truncate pr-6">
                          {conversation.title}
                        </span>
                        <span className="font-technical text-[10px] tracking-wide opacity-55">
                          {formatConversationDate(conversation.updatedAt)}
                        </span>
                      </button>
                      <button
                        type="button"
                        title="Apagar conversa"
                        aria-label={`Apagar conversa ${conversation.title}`}
                        className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full opacity-0 transition-opacity hover:bg-current/10 hover:text-destructive group-hover:opacity-60 hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => {
                          if (
                            !window.confirm(
                              "Apagar esta conversa? Os PDFs gerados nela saem do workspace para todos os membros. Esta ação não pode ser desfeita.",
                            )
                          ) {
                            return;
                          }
                          void deleteConversation(conversation.id);
                        }}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))
                )}
              </nav>
            </div>

            <div
              className={cn(
                "space-y-0.5 border-t border-hairline py-3",
                sidebarSectionX,
              )}
            >
              {chatExploreItems.map((item) => (
                <SidebarNavRow key={item.label} item={item} />
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
