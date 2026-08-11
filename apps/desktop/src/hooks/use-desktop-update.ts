import { getVersion } from "@tauri-apps/api/app";
import {
  isVersionBelow,
  type DesktopReleaseResponse,
} from "@linvo/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchDesktopRelease } from "@/lib/desktop-release-api";
import {
  applyDesktopUpdate,
  isAllowedManualDownloadUrl,
  openManualDownload,
} from "@/lib/desktop-updater";

const POLL_INTERVAL_MS = 60 * 60 * 1000;
const DISMISS_STORAGE_KEY = "linvo.desktop.update.dismissed";

export type DesktopUpdateStatus =
  | "idle"
  | "available"
  | "mandatory"
  | "updating"
  | "error";

export type DesktopUpdateState = {
  status: DesktopUpdateStatus;
  blocking: boolean;
  currentVersion: string | null;
  release: DesktopReleaseResponse | null;
  error: string | null;
  dismiss: () => void;
  applyUpdate: () => Promise<void>;
  openDownload: () => Promise<void>;
};

function readDismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeDismissedVersion(version: string) {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, version);
  } catch {
  }
}

export function useDesktopUpdate(enabled: boolean): DesktopUpdateState {
  const [status, setStatus] = useState<DesktopUpdateStatus>("idle");
  const [blocking, setBlocking] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [release, setRelease] = useState<DesktopReleaseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const blockingRef = useRef(false);
  const updatingRef = useRef(false);
  const statusRef = useRef<DesktopUpdateStatus>("idle");

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;

    async function poll() {
      try {
        const version = await getVersion();
        const remote = await fetchDesktopRelease();
        if (!active) {
          return;
        }

        setCurrentVersion(version);
        setRelease(remote);

        if (updatingRef.current) {
          return;
        }

        setError(null);

        if (isVersionBelow(version, remote.minSupportedVersion)) {
          blockingRef.current = true;
          setBlocking(true);
          setStatus("mandatory");
          return;
        }

        blockingRef.current = false;
        setBlocking(false);

        if (isVersionBelow(version, remote.latestVersion)) {
          const isDismissed = readDismissedVersion() === remote.latestVersion;
          setStatus(isDismissed ? "idle" : "available");
          return;
        }

        setStatus("idle");
      } catch (pollError) {
        if (!active || updatingRef.current) {
          return;
        }

        const message =
          pollError instanceof Error
            ? pollError.message
            : "Falha ao verificar atualização";

        setError(message);

        if (
          statusRef.current === "mandatory" ||
          statusRef.current === "updating"
        ) {
          return;
        }

        setStatus("error");
      }
    }

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled]);

  const dismiss = useCallback(() => {
    if (!release || (status !== "available" && status !== "error")) {
      return;
    }
    if (blockingRef.current || updatingRef.current) {
      return;
    }
    writeDismissedVersion(release.latestVersion);
    setError(null);
    setStatus("idle");
  }, [release, status]);

  const applyUpdate = useCallback(async () => {
    if (!release || updatingRef.current) {
      return;
    }

    updatingRef.current = true;
    setStatus("updating");
    setError(null);

    try {
      await applyDesktopUpdate();
    } catch (updateError) {
      updatingRef.current = false;
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Falha ao aplicar atualização",
      );
      setStatus(blockingRef.current ? "mandatory" : "available");
    }
  }, [release]);

  const openDownload = useCallback(async () => {
    if (!release) {
      return;
    }
    if (!isAllowedManualDownloadUrl(release.downloadUrl)) {
      setError("URL de download não permitida");
      return;
    }
    await openManualDownload(release.downloadUrl);
  }, [release]);

  return {
    status,
    blocking,
    currentVersion,
    release,
    error,
    dismiss,
    applyUpdate,
    openDownload,
  };
}
