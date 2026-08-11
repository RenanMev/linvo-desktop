import { useEffect, useState } from "react";

import { fetchChatAttachmentBlob } from "@/lib/chat/chat-attachments-api";
import type { ChatAttachment } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type ChatAttachmentImageProps = {
  attachment: ChatAttachment;
  conversationId?: string | null;
  className?: string;
};

export function ChatAttachmentImage({
  attachment,
  conversationId = null,
  className,
}: ChatAttachmentImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(
    attachment.url ?? null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (attachment.url) {
      setObjectUrl(attachment.url);
      setFailed(false);
      return;
    }

    if (!conversationId) {
      setObjectUrl(null);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;

    void fetchChatAttachmentBlob(conversationId, attachment.id)
      .then((blob) => {
        if (cancelled) {
          return;
        }
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setObjectUrl(null);
        }
      });

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [attachment.id, attachment.url, conversationId]);

  if (!objectUrl) {
    return (
      <div
        className={cn(
          "grid h-28 w-44 place-items-center rounded-lg border border-hairline bg-surface-raise-2 text-[11px] text-muted-foreground",
          className,
        )}
      >
        {failed ? "Imagem indisponível" : attachment.filename}
      </div>
    );
  }

  return (
    <img
      src={objectUrl}
      alt={attachment.filename}
      className={cn(
        "max-h-48 max-w-full rounded-lg border border-hairline/60 object-contain",
        className,
      )}
    />
  );
}
