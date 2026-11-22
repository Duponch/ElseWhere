/** Short name shown under a portrait of the colonist bar (Core
 * `Pawn.LabelShort`, i.e. `NameTriple.ToStringShort`, the nickname; a single
 * name is itself). Elsewhere keeps one display string per person: a generated
 * first name, an imported « Prénom « Surnom » Nom » or an ancient
 * Prénom 'Surnom' Nom. The nickname is read back from its quotes; without one,
 * the first word stands for the name (a triple whose nickname equals the first
 * or last name is written « Prénom Nom », and which one it was is not kept).
 * Presentation only: the full name stays in the tooltip and the dossier. */
const QUOTED=/(?:^|\s)(?:«\s*|['"‘“])([^«»'"‘’“”]+?)(?:\s*»|['"’”])(?=\s|$)/u;

export function pawnShortName(name:string):string {
  const full=name.trim();
  const nick=QUOTED.exec(full)?.[1]?.trim();
  if(nick)return nick;
  return full.split(/\s+/u)[0]||full;
}
