import { resolvePermissions } from "@linvo/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/workspace/workspace-api", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/workspace/workspace-api")
  >("@/lib/workspace/workspace-api");
  return {
    ...actual,
    resolveWorkspaceImageUrl: (value: string | null) => value,
  };
});

import { WorkspaceStep } from "@/components/onboarding/steps/workspace-step";

const workspace = {
  id: "ws-1",
  name: "Atendimento",
  role: "OWNER" as const,
  permissions: resolvePermissions("OWNER"),
  imageUrl: null,
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-29T00:00:00.000Z",
};

function renderStep(
  overrides: Partial<React.ComponentProps<typeof WorkspaceStep>> = {},
) {
  const props: React.ComponentProps<typeof WorkspaceStep> = {
    workspaces: [workspace],
    activeWorkspaceId: null,
    workspaceName: "",
    imagePreviewUrl: null,
    busy: false,
    error: null,
    onSelectWorkspace: vi.fn(),
    onWorkspaceNameChange: vi.fn(),
    onImageChange: vi.fn(),
    onContinue: vi.fn(),
    ...overrides,
  };
  render(<WorkspaceStep {...props} />);
  return props;
}

describe("WorkspaceStep", () => {
  it("selects an existing workspace", async () => {
    const pointer = userEvent.setup();
    const props = renderStep();

    await pointer.click(
      screen.getByRole("button", { name: /Atendimento/ }),
    );

    expect(props.onSelectWorkspace).toHaveBeenCalledWith("ws-1");
  });

  it("validates a new workspace name before continuing", () => {
    renderStep({ workspaces: [], workspaceName: "A" });

    expect(
      screen.getByText(/pelo menos 2 caracteres/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });

  it("rejects an unsupported image type and keeps the selection callback idle", () => {
    const props = renderStep();
    const file = new File(["gif"], "workspace.gif", { type: "image/gif" });

    fireEvent.change(
      screen.getByLabelText("Arquivo de imagem do workspace"),
      { target: { files: [file] } },
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use uma imagem JPEG, PNG ou WebP",
    );
    expect(props.onImageChange).not.toHaveBeenCalled();
  });

  it("preserves the entered name while showing a creation error", () => {
    renderStep({
      workspaces: [],
      workspaceName: "Meu workspace",
      error: "Não foi possível configurar o workspace",
    });

    expect(screen.getByDisplayValue("Meu workspace")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível configurar o workspace",
    );
  });
});
