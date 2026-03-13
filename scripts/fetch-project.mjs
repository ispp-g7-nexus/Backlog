// Script para traer todas las issues del GitHub Project v2
// Uso: node scripts/fetch-project.mjs [TOKEN]
// Si no se pasa token, lo lee de .env.local (GITHUB_TOKEN=...)

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

function loadEnvLocal() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const envPath = resolve(root, '.env.local');
  if (!existsSync(envPath)) return {};
  return Object.fromEntries(
    readFileSync(envPath, 'utf8').split('\n')
      .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
      .map(l => l.split('=').map((p, i) => i === 0 ? p.trim() : l.slice(l.indexOf('=') + 1).trim()))
  );
}

const TOKEN = process.argv[2] || loadEnvLocal().GITHUB_TOKEN;
if (!TOKEN) { console.error("Token no encontrado. Pásalo como argumento o añádelo a .env.local"); process.exit(1); }

const ENDPOINT = "https://api.github.com/graphql";

const ITEM_FIELDS = `
  id type
  fieldValues(first: 20) {
    nodes {
      ... on ProjectV2ItemFieldTextValue        { text   field { ... on ProjectV2Field { name } } }
      ... on ProjectV2ItemFieldSingleSelectValue{ name   field { ... on ProjectV2SingleSelectField { name } } }
      ... on ProjectV2ItemFieldNumberValue      { number field { ... on ProjectV2Field { name } } }
      ... on ProjectV2ItemFieldDateValue        { date   field { ... on ProjectV2Field { name } } }
      ... on ProjectV2ItemFieldUserValue        { users(first:5){ nodes{ login name avatarUrl } } field { ... on ProjectV2Field { name } } }
      ... on ProjectV2ItemFieldLabelValue       { labels(first:10){ nodes{ name color } } field { ... on ProjectV2Field { name } } }
      ... on ProjectV2ItemFieldMilestoneValue   { milestone{ title } field { ... on ProjectV2Field { name } } }
      ... on ProjectV2ItemFieldRepositoryValue  { repository{ name } field { ... on ProjectV2Field { name } } }
    }
  }
  content {
    ... on Issue {
      number title body url state
      createdAt updatedAt closedAt
      assignees(first:5) { nodes { login name avatarUrl } }
      labels(first:10)   { nodes { name color } }
      milestone          { title dueOn }
    }
  }
`;

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function fetchAllItems() {
  let cursor = null;
  let allItems = [];
  let page = 0;

  do {
    page++;
    const afterClause = cursor ? `, after: "${cursor}"` : "";
    const query = `{
      organization(login: "ispp-g7-nexus") {
        projectV2(number: 2) {
          title
          items(first: 100${afterClause}) {
            pageInfo { hasNextPage endCursor }
            nodes { ${ITEM_FIELDS} }
          }
        }
      }
    }`;
    const data = await gql(query);
    const proj = data.organization.projectV2;
    const { nodes, pageInfo } = proj.items;
    allItems = allItems.concat(nodes);
    console.error(`Página ${page}: ${nodes.length} items (total: ${allItems.length})`);
    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor);

  return allItems;
}

// Convierte un item del proyecto a un objeto limpio
function normalize(item) {
  if (item.type !== "ISSUE" || !item.content) return null;
  const fields = {};
  for (const fv of item.fieldValues.nodes) {
    const fname = fv.field?.name;
    if (!fname) continue;
    if ("text"      in fv) fields[fname] = fv.text;
    if ("name"      in fv) fields[fname] = fv.name;      // SingleSelect
    if ("number"    in fv) fields[fname] = fv.number;
    if ("date"      in fv) fields[fname] = fv.date;
    if ("users"     in fv) fields[fname] = fv.users.nodes;
    if ("labels"    in fv) fields[fname] = fv.labels.nodes;
    if ("milestone" in fv) fields[fname] = fv.milestone?.title ?? null;
    if ("repository"in fv) fields[fname] = fv.repository?.name ?? null;
  }
  const c = item.content;
  return {
    id:         item.id,
    number:     c.number,
    title:      fields["Title"] ?? c.title,
    body:       c.body,
    url:        c.url,
    state:      c.state,          // OPEN | CLOSED
    status:     fields["Status"] ?? null,
    priority:   fields["Priority"] ?? null,
    size:       fields["Size"] ?? null,
    estimate:   fields["Estimate"] ?? null,
    startDate:  fields["Start date"] ?? null,
    targetDate: fields["Target date"] ?? null,
    equipo:     fields["Equipo"] ?? null,
    milestone:  fields["Milestone"] ?? c.milestone?.title ?? null,
    repository: fields["Repository"] ?? null,
    assignees:  fields["Assignees"] ?? c.assignees.nodes,
    labels:     fields["Labels"] ?? c.labels.nodes,
    createdAt:  c.createdAt,
    updatedAt:  c.updatedAt,
    closedAt:   c.closedAt,
  };
}

const items = await fetchAllItems();
const normalized = items.map(normalize).filter(Boolean);

// Metadatos del fetch
const output = {
  fetchedAt: new Date().toISOString(),
  total: normalized.length,
  statuses: ["Backlog","Ready","In progress","In review","Done"],
  priorities: ["P0","P1","P2"],
  sizes: ["XS","S","M","L","XL"],
  equipos: ["All","Equipo A","Equipo B","Equipo C","Equipo D","Equipo Presentación","Coordinadores"],
  items: normalized,
};

process.stdout.write(JSON.stringify(output, null, 2));
