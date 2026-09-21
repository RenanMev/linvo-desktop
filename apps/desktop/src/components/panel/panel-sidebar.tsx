import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bell,
  Building2,
  Boxes,
  ChevronDown,
  CreditCard,
  FileText,
  History,
  Keyboard,
  Layers,
  LibraryBig,
  LifeBuoy,
  ListChecks,
  Palette,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useConversations } from "@/context/chat-conversations-context";
import { useWorkspace } from "@/context/workspace-context";
import { useWorkspaceFileBlob } from "@/hooks/use-workspace-file-blob";
import { PANEL_HOME_ROUTE } from "@/lib/panel-routes";
import { resolveWorkspaceImageUrl } from "@/lib/workspace/workspace-api";
import { cn } from "@/lib/utils";

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

/*
 * Seção que a rota atual pertence. Decide o que a área contextual mostra
 * (lista de conversas, grupos de configuração ou nada) e qual item do topo
 * fica aceso — "Procedimentos" mora sob /settings/workspace/:id/, então a
 * checagem por prefixo de /settings sozinha acenderia os dois.
 */
type SidebarSection = "history" | "documents" | "procedures" | "settings";

function resolveSection(
  pathname: string,
  proceduresRoute: string | null,
): SidebarSection {
  if (pathname.startsWith("/chat")) {
    return "history";
  }
  if (pathname === "/documents") {
    return "documents";
  }
  if (proceduresRoute && pathname.startsWith(proceduresRoute)) {
    return "procedures";
  }
  return "settings";
}

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
      { label: "Atalhos", icon: Keyboard, to: "/settings/shortcuts" },
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
      { label: "Modelos", icon: Boxes, to: "/settings/models" },
      { label: "Ferramentas & MCPs", icon: Layers, soon: true },
      { label: "Privacidade", icon: ShieldCheck, soon: true },
    ],
  },
];

const footerItems: NavItem[] = [
  { label: "Arquivadas", icon: Archive, soon: true },
  { label: "Biblioteca", icon: LibraryBig, soon: true },
  { label: "Central de ajuda", icon: LifeBuoy, soon: true },
];

const sidebarSectionX = "px-3";
const sidebarHeaderY = "pt-3.5 pb-2";
const sidebarBlockBottom = "pb-2";
const sidebarRowX = "px-2.5";
const navRowBase = `flex w-full items-center gap-2.5 rounded-lg ${sidebarRowX} py-1.5 text-[13px] transition-colors duration-150`;
const navRowIdle =
  "text-sidebar-foreground/65 [&_svg]:opacity-45 hover:bg-surface-hover hover:text-sidebar-foreground hover:[&_svg]:opacity-80";
const navRowActive = "nav-pill-active font-medium [&_svg]:opacity-100";
const collapsedIconBase =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150";
const collapsedIconIdle =
  "text-sidebar-foreground/65 [&_svg]:opacity-45 hover:bg-surface-hover hover:text-sidebar-foreground hover:[&_svg]:opacity-90";
const navIcon = "size-3.5 shrink-0";
const searchInputClass =
  "h-8 rounded-lg border-transparent bg-surface-raise-1 pl-8 text-xs shadow-none hover:border-transparent hover:bg-surface-raise-2 focus-visible:translate-y-0 focus-visible:border-hairline focus-visible:bg-surface-raise-2 focus-visible:ring-0";

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

function SoonHint() {
  return (
    <span className="font-technical text-[9px] font-medium tracking-wide text-muted-foreground/70">
      Em breve
    </span>
  );
}

function SidebarSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={searchInputClass}
      />
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-1 px-2.5 font-technical text-[10px] font-medium tracking-wide text-muted-foreground/80">
      {children}
    </p>
  );
}

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
          "cursor-default justify-between text-sidebar-foreground/35 [&_svg]:opacity-40",
        )}
        aria-disabled="true"
      >
        <span className="flex items-center gap-2.5">
          <Icon className={navIcon} />
          {item.label}
        </span>
        <SoonHint />
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

/*
 * Linha do topo: o "ativo" vem da seção resolvida, não do NavLink — ver
 * `resolveSection`. Sem rota (Procedimentos sem workspace ativo) fica
 * desabilitada sem o selo "Em breve": não é futuro, é pré-condição.
 */
function TopNavRow({
  label,
  icon: Icon,
  to,
  active,
  onNavigate,
}: {
  label: string;
  icon: LucideIcon;
  to: string | null;
  active: boolean;
  onNavigate?: () => void;
}) {
  if (!to) {
    return (
      <div
        className={cn(
          navRowBase,
          "cursor-default text-sidebar-foreground/35 [&_svg]:opacity-40",
        )}
        aria-disabled="true"
      >
        <Icon className={navIcon} />
        {label}
      </div>
    );
  }

  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(navRowBase, active ? navRowActive : navRowIdle)}
    >
      <Icon className={navIcon} />
      {label}
    </Link>
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

function CollapsedDivider() {
  return <div className="my-1 h-px w-6 shrink-0 bg-hairline" />;
}

type PanelSidebarProps = {
  collapsed: boolean;
};

export function PanelSidebar({ collapsed }: PanelSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const {
    conversations,
    activeId,
    isLoading,
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

  const proceduresRoute = activeWorkspace
    ? `/settings/workspace/${activeWorkspace.id}/procedures`
    : null;
  const section = resolveSection(location.pathname, proceduresRoute);

  const topNav = [
    {
      label: "Histórico",
      icon: History,
      to: "/chat",
      active: section === "history",
    },
    {
      label: "Documentos",
      icon: FileText,
      to: "/documents",
      active: section === "documents",
    },
    {
      label: "Procedimentos",
      icon: ListChecks,
      to: proceduresRoute,
      active: section === "procedures",
    },
    {
      label: "Configurações",
      icon: Settings,
      to: "/settings/general",
      active: section === "settings",
    },
  ];

  useEffect(() => {
    setSearchQuery("");
  }, [section]);

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
  const collapsedTabIndex = collapsed ? 0 : -1;
  const allSettingsItems = useMemo(
    () => settingsGroups.flatMap((group) => group.items),
    [],
  );

  const workspaceInitial = (activeWorkspace?.name ?? "L")
    .slice(0, 1)
    .toUpperCase();

  return (
    <aside
      className={cn(
        "relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-hairline bg-sidebar text-sidebar-foreground",
        "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width]",
        collapsed ? "w-14" : "w-64",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center gap-1 overflow-hidden px-1.5 py-3 transition-opacity duration-200",
          collapsed
            ? "z-10 opacity-100"
            : "pointer-events-none z-0 opacity-0",
        )}
        aria-hidden={!collapsed}
      >
        <button
          type="button"
          title={activeWorkspace?.name ?? "Workspace"}
          tabIndex={collapsedTabIndex}
          onClick={() => navigate(PANEL_HOME_ROUTE)}
          className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-sidebar-primary text-[10px] font-semibold text-sidebar-primary-foreground transition-opacity hover:opacity-90"
        >
          {activeWorkspaceImageSrc ? (
            <img
              src={activeWorkspaceImageSrc}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            workspaceInitial
          )}
        </button>
        <CollapsedDivider />
        {topNav.map((item) => (
          <CollapsedIconButton
            key={item.label}
            title={item.label}
            icon={item.icon}
            tabIndex={collapsedTabIndex}
            active={item.active}
            disabled={item.to == null}
            onClick={item.to ? () => navigate(item.to!) : undefined}
          />
        ))}
        <CollapsedDivider />
        <div className="mt-0.5 flex min-h-0 w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {section === "history" &&
            !isLoading &&
            filteredConversations.slice(0, 8).map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                title={conversation.title}
                tabIndex={collapsedTabIndex}
                onClick={() => selectConversation(conversation.id)}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg font-technical text-[10px] font-semibold transition-colors duration-150",
                  activeId === conversation.id
                    ? "nav-pill-active"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-sidebar-foreground",
                )}
              >
                {conversation.title.trim().slice(0, 1).toUpperCase() || "C"}
              </button>
            ))}
          {section === "settings" &&
            allSettingsItems.map((item) => (
              <CollapsedSettingsNavItem
                key={item.label}
                item={item}
                tabIndex={collapsedTabIndex}
              />
            ))}
        </div>
        <CollapsedDivider />
        {footerItems.map((item) => (
          <CollapsedIconButton
            key={item.label}
            title={item.label}
            icon={item.icon}
            tabIndex={collapsedTabIndex}
            disabled
          />
        ))}
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
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 text-left transition-colors hover:bg-surface-hover",
                    sidebarRowX,
                  )}
                  title="Trocar workspace"
                />
              }
            >
              <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-lg bg-sidebar-primary text-[10px] font-semibold text-sidebar-primary-foreground">
                {activeWorkspaceImageSrc ? (
                  <img
                    src={activeWorkspaceImageSrc}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  workspaceInitial
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight">
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
        </div>

        <nav
          className={cn("space-y-0.5", sidebarSectionX, sidebarBlockBottom)}
          aria-label="Seções do painel"
        >
          {topNav.map((item) => (
            <TopNavRow
              key={item.label}
              label={item.label}
              icon={item.icon}
              to={item.to}
              active={item.active}
              onNavigate={resetSearch}
            />
          ))}
        </nav>

        {section === "history" ? (
          <>
            <div className={cn(sidebarSectionX, sidebarBlockBottom)}>
              <SidebarSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Buscar conversas"
              />
            </div>

            <div
              className={cn("flex min-h-0 flex-1 flex-col", sidebarSectionX)}
            >
              <SectionLabel>Conversas</SectionLabel>
              <nav
                className="scrollbar-elegant scrollbar-sidebar -mr-3 min-h-0 flex-1 space-y-0.5 overflow-y-auto"
                aria-label="Conversas"
              >
                {isLoading ? (
                  <p className="px-2.5 py-1.5 text-[11px] text-muted-foreground">
                    Carregando conversas...
                  </p>
                ) : filteredConversations.length === 0 ? (
                  <p className="px-2.5 py-1.5 text-[11px] text-muted-foreground">
                    {conversations.length === 0
                      ? "Nenhuma conversa ainda"
                      : "Nenhuma conversa encontrada"}
                  </p>
                ) : (
                  filteredConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={cn(
                        "group relative flex items-center rounded-lg transition-colors duration-150",
                        activeId === conversation.id
                          ? "nav-pill-active font-medium"
                          : "text-sidebar-foreground/70 hover:bg-surface-hover hover:text-sidebar-foreground",
                      )}
                    >
                      <button
                        type="button"
                        title={`${conversation.title} · ${formatConversationDate(conversation.updatedAt)}`}
                        onClick={() => selectConversation(conversation.id)}
                        className={cn(
                          "min-w-0 flex-1 truncate py-1.5 text-left text-[13px]",
                          sidebarRowX,
                          "pr-7",
                        )}
                      >
                        {conversation.title}
                      </button>
                      <button
                        type="button"
                        title="Apagar conversa"
                        aria-label={`Apagar conversa ${conversation.title}`}
                        className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md opacity-0 transition-opacity hover:bg-current/10 hover:text-destructive group-hover:opacity-60 hover:opacity-100 focus-visible:opacity-100"
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
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </nav>
            </div>
          </>
        ) : section === "settings" ? (
          <>
            <div className={cn(sidebarSectionX, sidebarBlockBottom)}>
              <SidebarSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Buscar configurações"
              />
            </div>

            <nav
              className={cn(
                "scrollbar-elegant scrollbar-sidebar min-h-0 flex-1 space-y-4 overflow-y-auto pb-3",
                sidebarSectionX,
              )}
              aria-label="Seções de configurações"
            >
              {filteredSettingsGroups.length === 0 ? (
                <p className="px-2.5 py-1.5 text-[11px] text-muted-foreground">
                  Nenhuma configuração encontrada
                </p>
              ) : (
                filteredSettingsGroups.map((group) => (
                  <div key={group.id} className="space-y-0.5">
                    {group.label ? (
                      <SectionLabel>{group.label}</SectionLabel>
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
          </>
        ) : (
          <div className="min-h-0 flex-1" />
        )}

        <div className={cn("space-y-0.5 py-3", sidebarSectionX)}>
          {footerItems.map((item) => (
            <SidebarNavRow key={item.label} item={item} />
          ))}
        </div>
      </div>
    </aside>
  );
}
