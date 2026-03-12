import { normDate } from '../lib/utils.js';
import { BACKLOG_MAP } from './backlog-map.js';

export function parseClockifyCSV(text) {
  // Clockify detailed CSV headers (may vary by language):
  // Project,Client,Description,Task,User,Group,Email,Tags,Billable,
  // Start Date,Start Time,End Date,End Time,Duration (h),Duration (decimal),...
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const rawHeaders = lines[0].split(",").map(h => h.replace(/^"|"$/g,"").trim().toLowerCase());

  const col = (names) => {
    for (const n of names) {
      const i = rawHeaders.findIndex(h => h.includes(n));
      if (i !== -1) return i;
    }
    return -1;
  };

  const iUser     = col(["user", "usuario"]);
  const iEmail    = col(["email"]);
  const iProject  = col(["project", "proyecto"]);
  const iTags     = col(["tags", "etiquetas", "tag"]);
  const iDurH     = col(["duration (h)", "duración (h)", "duracion (h)"]);
  const iDurDec   = col(["duration (decimal)", "decimal"]);
  const iStart    = col(["start date", "fecha inicio"]);
  const iDesc     = col(["description", "descripción"]);

  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    // parse CSV line respecting quoted fields
    const row = [];
    let cur = "", inQ = false;
    for (const ch of lines[i] + ",") {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { row.push(cur.trim()); cur = ""; }
      else cur += ch;
    }

    const user    = iUser    >= 0 ? row[iUser]    || "" : "";
    const email   = iEmail   >= 0 ? (row[iEmail]  || "").toLowerCase().trim() : "";
    const project = iProject >= 0 ? (row[iProject]|| "").toLowerCase().trim() : "";
    const tags    = iTags    >= 0 ? row[iTags]    || "" : "";
    const durH    = iDurH    >= 0 ? row[iDurH]    || "0:00:00" : "0:00:00";
    const durDec  = iDurDec  >= 0 ? parseFloat(row[iDurDec]) || 0 : 0;
    const date    = iStart   >= 0 ? (row[iStart]  || "").slice(0, 10) : "";
    const desc    = iDesc    >= 0 ? row[iDesc]    || "" : "";

    // parse duration h:mm:ss
    let hours = durDec;
    if (!hours) {
      const parts = durH.split(":").map(Number);
      hours = (parts[0]||0) + (parts[1]||0)/60 + (parts[2]||0)/3600;
    }
    if (!hours) continue;

    // find task ID in tags or description (NX-S1.1, NX-S1.01, NX-S2.3, etc.)
    const combined = tags + " " + desc;
    const match = combined.match(/NX-S([1-3])\.(\d{1,3})/i);
    // Normalise to 2-digit task number to match BACKLOG_MAP keys (NX-S1.01, NX-S1.10…)
    const taskId = match
      ? `NX-S${match[1]}.${match[2].padStart(2, '0')}`
      : null;

    entries.push({ user, email, project, taskId, hours, date });
  }
  return entries;
}

export function buildReport(entries) {
  const byTask = {};
  Object.entries(BACKLOG_MAP).forEach(([tid, t]) => {
    byTask[tid] = { ...t, real_h: 0, byUser: {} };
  });
  const byUser  = {};
  const byEmail = {}; // keyed by lowercase email → { name, total_h, dp_h, s1_h }
  const dailyHours = {};
  const dailyHoursBySprint = { 1:{}, 2:{}, 3:{} };
  const dailyHoursByProject = {};

  entries.forEach(({ user, email, project, taskId, hours, date }) => {
    const nd = normDate(date);
    // Track daily hours by project (s1/s2/s3/dp) — includes untagged entries
    if (nd && project) {
      dailyHoursByProject[project] = dailyHoursByProject[project] || {};
      dailyHoursByProject[project][nd] = (dailyHoursByProject[project][nd] || 0) + hours;
    }
    if (taskId && byTask[taskId]) {
      byTask[taskId].real_h += hours;
      byTask[taskId].byUser[user] = (byTask[taskId].byUser[user] || 0) + hours;
      const sn = byTask[taskId].sprint;
      if (sn && nd) dailyHoursBySprint[sn][nd] = (dailyHoursBySprint[sn][nd] || 0) + hours;
    }
    if (user) {
      byUser[user] = byUser[user] || { total_h: 0, byTask: {} };
      byUser[user].total_h += hours;
      if (taskId) byUser[user].byTask[taskId] = (byUser[user].byTask[taskId] || 0) + hours;
    }
    if (email) {
      byEmail[email] = byEmail[email] || { name: user, total_h: 0, tagged_h: 0, dp_h: 0, s1_h: 0, s1_tagged_h: 0, s2_h: 0, s2_tagged_h: 0, s3_h: 0, s3_tagged_h: 0 };
      byEmail[email].total_h += hours;
      if (taskId) byEmail[email].tagged_h += hours;
      if (project === "dp") byEmail[email].dp_h += hours;
      if (project === "s1") { byEmail[email].s1_h += hours; if (taskId) byEmail[email].s1_tagged_h += hours; }
      if (project === "s2") { byEmail[email].s2_h += hours; if (taskId) byEmail[email].s2_tagged_h += hours; }
      if (project === "s3") { byEmail[email].s3_h += hours; if (taskId) byEmail[email].s3_tagged_h += hours; }
    }
    if (nd) dailyHours[nd] = (dailyHours[nd] || 0) + hours;
  });

  return { byTask, byUser, byEmail, dailyHours, dailyHoursBySprint, dailyHoursByProject };
}
