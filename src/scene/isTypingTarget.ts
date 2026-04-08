/** True when the event target is a control where we should not steal game keys. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.closest('textarea, select')) return true
  const input = target.closest('input')
  if (input instanceof HTMLInputElement) {
    const t = input.type
    if (
      t === 'checkbox' ||
      t === 'radio' ||
      t === 'button' ||
      t === 'submit' ||
      t === 'reset' ||
      t === 'range' ||
      t === 'color' ||
      t === 'file' ||
      t === 'hidden'
    ) {
      return false
    }
    return true
  }
  return false
}
