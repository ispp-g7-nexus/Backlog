import { rawData } from '../data.js';

export async function fetchFromGitHub(token) {
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
        assignees(first:10) { nodes { login name avatarUrl } }
        labels(first:10)    { nodes { name color } }
        milestone           { title dueOn }
      }
    }
  `;
  async function gql(query) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    if (json.errors) throw new Error(json.errors.map(e => e.message).join('; '));
    return json.data;
  }
  let cursor = null, allItems = [];
  do {
    const after = cursor ? `, after: "${cursor}"` : "";
    const data = await gql(`{
      organization(login: "ispp-g7-nexus") {
        projectV2(number: 2) {
          items(first: 100${after}) {
            pageInfo { hasNextPage endCursor }
            nodes { ${ITEM_FIELDS} }
          }
        }
      }
    }`);
    const { nodes, pageInfo } = data.organization.projectV2.items;
    allItems = allItems.concat(nodes);
    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor);

  function normalizeItem(item) {
    if (item.type !== "ISSUE" || !item.content) return null;
    const fields = {};
    for (const fv of item.fieldValues.nodes) {
      const fname = fv.field?.name;
      if (!fname) continue;
      if ("text"       in fv) fields[fname] = fv.text;
      if ("name"       in fv) fields[fname] = fv.name;
      if ("number"     in fv) fields[fname] = fv.number;
      if ("date"       in fv) fields[fname] = fv.date;
      if ("users"      in fv) fields[fname] = fv.users.nodes;
      if ("labels"     in fv) fields[fname] = fv.labels.nodes;
      if ("milestone"  in fv) fields[fname] = fv.milestone?.title ?? null;
      if ("repository" in fv) fields[fname] = fv.repository?.name ?? null;
    }
    const c = item.content;
    return {
      id: item.id, number: c.number,
      title: fields["Title"] ?? c.title, body: c.body, url: c.url, state: c.state,
      status: fields["Status"] ?? null, priority: fields["Priority"] ?? null,
      size: fields["Size"] ?? null, estimate: fields["Estimate"] ?? null,
      startDate: fields["Start date"] ?? null, targetDate: fields["Target date"] ?? null,
      equipo: fields["Equipo"] ?? null,
      milestone: fields["Milestone"] ?? c.milestone?.title ?? null,
      repository: fields["Repository"] ?? null,
      assignees: fields["Assignees"] ?? c.assignees.nodes,
      labels: fields["Labels"] ?? c.labels.nodes,
      createdAt: c.createdAt, updatedAt: c.updatedAt, closedAt: c.closedAt,
    };
  }
  const normalized = allItems.map(normalizeItem).filter(Boolean);
  return {
    fetchedAt: new Date().toISOString(),
    total: normalized.length,
    statuses:   rawData.statuses,
    priorities: rawData.priorities,
    sizes:      rawData.sizes,
    equipos:    rawData.equipos,
    items: normalized,
  };
}
