import { RULE_DOMAINS, RULES_BY_ID, UNDESCRIBED_DOMAINS } from './rules-registry.ts';
import { COVERAGE_LABELS, FIDELITY_LABELS, type Rule, type RuleDomain, type RuleTable, type RuleValue } from './rules-types.ts';
import { formatBare, formatCell, formatValue, textParts } from './rules-helpers.ts';
import { filterRules, rulesStats, sourceUrl } from './rules-view.ts';

/** Developer page `rules.html` (docs/development/rules-page.md): every rule of
 * the game, by domain, generated from the simulation code. Strings are always
 * set with textContent. */
const doc = document;
const toc = doc.querySelector<HTMLElement>('#toc')!, content = doc.querySelector<HTMLElement>('#content')!;
const search = doc.querySelector<HTMLInputElement>('#search')!, stats = doc.querySelector<HTMLElement>('#stats')!;
const coverage = doc.querySelector<HTMLElement>('#coverage')!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}
function link(href: string, text: string, external = false): HTMLAnchorElement {
  const a = el('a', text); a.href = href; if (external) { a.target = '_blank'; a.rel = 'noopener'; } return a;
}
const domainAnchor = (id: string): string => `domaine-${id}`;

function prose(text: string, values: readonly RuleValue[], tag: 'p' | 'code' = 'p', className?: string): HTMLElement {
  const node = el(tag, undefined, className);
  for (const part of textParts(text, values)) {
    if (part.kind === 'text') { node.append(part.text); continue; }
    const value = el('span', formatBare(part.value), 'value');
    value.title = `${part.value.label} · ${part.value.source.file} · ${part.value.source.symbol}`;
    node.append(value);
  }
  return node;
}
function valuesList(rule: Rule): HTMLElement {
  const wrap = el('div', undefined, 'table-wrap'), t = el('table', undefined, 'values');
  t.append(el('caption', 'Les nombres de cette règle'));
  const head = el('tr'); for (const h of ['Nombre', 'Valeur', 'Source', 'Origine']) { const th = el('th', h); th.scope = 'col'; head.append(th); }
  const thead = el('thead'); thead.append(head); t.append(thead);
  const body = el('tbody');
  for (const v of rule.values) {
    const row = el('tr'), source = el('td');
    source.append(link(sourceUrl(v.source.file), v.source.file, true), el('span', ` · ${v.source.symbol}`, 'symbol'));
    row.append(el('td', v.label), el('td', formatValue(v), 'num'), source, el('td', v.origin === 'code' ? 'lu dans le code' : 'écrit dans la fonction'));
    body.append(row);
  }
  t.append(body); wrap.append(t);
  // Folded: the prose already shows every number; this says where each comes from.
  const details = el('details', undefined, 'numbers'), summary = el('summary', `D’où viennent les ${rule.values.length} nombres`);
  details.append(summary, wrap); return details;
}
function dataTable(table: RuleTable): HTMLElement {
  const wrap = el('div', undefined, 'table-wrap'), t = el('table');
  const caption = el('caption'); caption.append(`${table.caption} `, el('span', `(${table.rows.length} lignes · ${table.source.file} · ${table.source.symbol})`, 'caption-source'));
  t.append(caption);
  const head = el('tr'); for (const column of table.columns) { const th = el('th', column); th.scope = 'col'; head.append(th); }
  const thead = el('thead'); thead.append(head); t.append(thead);
  const body = el('tbody');
  for (const row of table.rows) {
    const tr = el('tr');
    row.forEach((cell, index) => { const td = el(index === 0 ? 'th' : 'td', formatCell(cell), typeof cell === 'number' ? 'num' : undefined); if (index === 0) (td as HTMLTableCellElement).scope = 'row'; tr.append(td); });
    body.append(tr);
  }
  t.append(body); wrap.append(t);
  if (table.rows.length <= 15) return wrap;
  const details = el('details', undefined, 'long-table'), summary = el('summary', `${table.caption} : afficher les ${table.rows.length} lignes`);
  details.append(summary, wrap); return details;
}
function ruleCard(rule: Rule): HTMLElement {
  const card = el('article', undefined, 'rule'); card.id = rule.id; card.setAttribute('aria-labelledby', `${rule.id}-titre`);
  const title = el('h3'); title.id = `${rule.id}-titre`;
  const anchor = link(`#${rule.id}`, rule.title); anchor.className = 'anchor'; title.append(anchor); card.append(title);
  const meta = el('div', undefined, 'meta');
  meta.append(el('span', FIDELITY_LABELS[rule.fidelity], `badge ${rule.fidelity}`), el('code', rule.id));
  card.append(meta, prose(rule.text, rule.values));
  if (rule.formula) { const formula = el('p', undefined, 'formula'); formula.append(el('span', 'Calcul : ', 'label'), prose(rule.formula, rule.values, 'code')); card.append(formula); }
  if (rule.fidelityNote) card.append(el('p', rule.fidelityNote, 'fidelity-note'));
  if (rule.values.length) card.append(valuesList(rule));
  for (const table of rule.tables) card.append(dataTable(table));
  const foot = el('dl', undefined, 'foot');
  const sources = el('dd'); rule.sources.forEach((s, i) => { if (i) sources.append(' · '); sources.append(link(sourceUrl(s.file), `${s.file} (${s.symbol})`, true)); });
  foot.append(el('dt', 'Code'), sources);
  if (rule.notes.length) { const notes = el('dd'); rule.notes.forEach((n, i) => { if (i) notes.append(' · '); notes.append(link(sourceUrl(n), n.replace(/^docs\//, ''), true)); }); foot.append(el('dt', 'Notes'), notes); }
  if (rule.related.length) {
    const related = el('dd');
    rule.related.forEach((id, i) => { if (i) related.append(' · '); const target = RULES_BY_ID.get(id); related.append(link(`#${id}`, target ? target.title : id)); });
    foot.append(el('dt', 'Voir aussi'), related);
  }
  card.append(foot);
  return card;
}

const expanded = new Set<string>(RULE_DOMAINS.map(d => d.id));
function domainSection(domain: RuleDomain, rules: readonly Rule[], open: boolean): HTMLElement {
  const section = el('section', undefined, 'domain'); section.id = domainAnchor(domain.id);
  const heading = el('h2'), toggle = el('button', undefined, 'toggle');
  toggle.type = 'button'; toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-controls', `${domain.id}-regles`);
  toggle.append(el('span', domain.label, 'domain-title'), el('span', `${COVERAGE_LABELS[domain.coverage]} · ${rules.length} règle${rules.length > 1 ? 's' : ''}`, `badge coverage ${domain.coverage}`));
  heading.append(toggle); section.append(heading);
  const body = el('div', undefined, 'domain-body'); body.id = `${domain.id}-regles`; body.hidden = !open;
  // Folding touches this section only, not the whole page.
  toggle.onclick = () => {
    const show = body.hidden; body.hidden = !show; toggle.setAttribute('aria-expanded', String(show));
    if (show) expanded.add(domain.id); else expanded.delete(domain.id);
  };
  body.append(el('p', domain.summary, 'summary'));
  if (domain.missing.length) { const missing = el('p', undefined, 'missing'); missing.append(el('strong', 'Pas encore décrit ici : '), domain.missing.join(' ; ') + '.'); body.append(missing); }
  for (const rule of rules) body.append(ruleCard(rule));
  section.append(body);
  return section;
}

function renderCoverage(): void {
  coverage.replaceChildren();
  const list = el('ul', undefined, 'coverage-list');
  for (const domain of RULE_DOMAINS) { const item = el('li'); item.append(link(`#${domainAnchor(domain.id)}`, domain.label), ' ', el('span', COVERAGE_LABELS[domain.coverage], `badge coverage ${domain.coverage}`)); list.append(item); }
  const absent = el('ul', undefined, 'absent-list');
  for (const missing of UNDESCRIBED_DOMAINS) { const item = el('li'); item.append(el('strong', missing.label), ` : ${missing.scope}`); absent.append(item); }
  coverage.append(el('h2', 'Couverture'), list, el('h3', 'Pas encore décrit'), absent);
}

function render(): void {
  const query = search.value.trim(), visible = filterRules(RULE_DOMAINS, query);
  toc.replaceChildren(); content.replaceChildren();
  const list = el('ul');
  for (const domain of RULE_DOMAINS) {
    const rules = visible.get(domain.id); if (!rules) continue;
    const item = el('li'); item.append(link(`#${domainAnchor(domain.id)}`, domain.label), el('span', ` ${rules.length}`, 'count')); list.append(item);
    content.append(domainSection(domain, rules, query ? true : expanded.has(domain.id)));
  }
  toc.append(el('h2', 'Sommaire'), list);
  const all = rulesStats(RULE_DOMAINS), shown = [...visible.values()].reduce((n, r) => n + r.length, 0);
  stats.textContent = query
    ? `${shown} règle${shown > 1 ? 's' : ''} sur ${all.rules} pour « ${query} »`
    : `${all.domains} domaines · ${all.rules} règles · ${all.values} nombres · ${all.tables} tableaux (${all.rows} lignes)`;
  if (!visible.size) content.append(el('p', 'Aucune règle ne correspond à la recherche.', 'empty'));
}

function reveal(): void {
  const id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
  const ruleDomain = RULES_BY_ID.get(id)?.domain ?? (id.startsWith('domaine-') ? id.slice(8) : undefined);
  if (ruleDomain && !expanded.has(ruleDomain)) { expanded.add(ruleDomain); render(); }
  if (search.value && !doc.getElementById(id)) { search.value = ''; render(); }
  doc.getElementById(id)?.scrollIntoView({ block: 'start' });
}

let pending = 0;
search.addEventListener('input', () => { clearTimeout(pending); pending = window.setTimeout(render, 120); });
doc.querySelector<HTMLButtonElement>('#expand')!.onclick = () => { for (const d of RULE_DOMAINS) expanded.add(d.id); render(); };
doc.querySelector<HTMLButtonElement>('#collapse')!.onclick = () => { expanded.clear(); render(); };
window.addEventListener('hashchange', reveal);
renderCoverage(); render(); reveal();
