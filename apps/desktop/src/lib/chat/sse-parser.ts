export function parseSseBlock(block: string): { event: string; data: unknown } | null {
  const lines = block.split("\n").filter(Boolean);
  const eventLine = lines.find((line) => line.startsWith("event: "));
  const dataLine = lines.find((line) => line.startsWith("data: "));

  if (!eventLine || !dataLine) return null;

  return {
    event: eventLine.replace("event: ", ""),
    data: JSON.parse(dataLine.replace("data: ", "")),
  };
}

export function parseSsePayload(body: string): Array<{ event: string; data: unknown }> {
  const events: Array<{ event: string; data: unknown }> = [];
  const blocks = body.split("\n\n").filter(Boolean);

  for (const block of blocks) {
    const parsed = parseSseBlock(block);
    if (parsed) events.push(parsed);
  }

  return events;
}
