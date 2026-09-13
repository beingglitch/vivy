/**
 * The state every screen starts in.
 *
 * Deliberately quiet: no illustration, no call to action, no "get started"
 * button. Nothing can be added from most of these screens yet, so a prompt
 * would point at a door that does not open. Guidance arrives when the thing it
 * points at does.
 *
 * The `hint` line says what would fill this screen, so an empty one reads as
 * "nothing has happened yet" rather than "this is broken".
 */
export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      <p className="empty__hint">{hint}</p>
    </div>
  );
}
