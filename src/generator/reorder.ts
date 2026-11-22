// Een kleur één plek omhoog of omlaag (S-099), zoals Omhoog en Omlaag in de app.

/** Welke pijltjes een kleur heeft: de eerste alleen omlaag, de laatste alleen omhoog, één kleur geen. */
export function arrows(i: number, n: number) {
  return { up: i > 0 && i < n, down: i >= 0 && i < n - 1 };
}

/** De lijst met plek `i` en `to` geruild; buiten de lijst blijft hij gelijk. */
export function moved<T>(list: readonly T[], i: number, to: number): T[] {
  const next = [...list];
  if (i < 0 || i >= list.length || to < 0 || to >= list.length) return next;
  [next[i], next[to]] = [next[to], next[i]];
  return next;
}
