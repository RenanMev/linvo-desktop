import { useEffect, useState } from "react";

import { authorizedFetch } from "@/lib/auth/http";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export type WorkspaceFileBlobState = {
  blobUrl: string | null;
  loading: boolean;
  error: Error | null;
};

function belongsToApiOrigin(url: string): boolean {
  try {
    return new URL(url, API_URL).origin === new URL(API_URL).origin;
  } catch {
    return false;
  }
}

export function useWorkspaceFileBlob(
  url: string | null,
): WorkspaceFileBlobState {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const controller = new AbortController();

    setBlobUrl(null);
    setError(null);

    if (!url) {
      setLoading(false);
      return () => {
        active = false;
        controller.abort();
      };
    }

    setLoading(true);

    if (!belongsToApiOrigin(url)) {
      setBlobUrl(url);
      setLoading(false);
      return () => {
        active = false;
        controller.abort();
      };
    }

    void authorizedFetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Falha ao carregar arquivo (${response.status})`);
        }
        return response.blob();
      })
      .then((blob) => {
        if (!active) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch((caught) => {
        if (!active) {
          return;
        }
        setError(
          caught instanceof Error
            ? caught
            : new Error("Falha ao carregar arquivo"),
        );
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  return { blobUrl, loading, error };
}
