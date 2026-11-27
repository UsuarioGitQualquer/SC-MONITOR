export function canRestoreManualEntryDraft(draft, context) {
  if (!draft || !context) return false;
  if (
    draft.modelId !== context.modelId ||
    draft.dateKey !== context.dateKey ||
    draft.mode !== context.mode
  ) {
    return false;
  }
  return draft.scope !== "live" || draft.sessionId === context.sessionId;
}
