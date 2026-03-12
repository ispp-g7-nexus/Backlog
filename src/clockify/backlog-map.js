import { TEAM_MEMBERS, SIZE_H_MAP } from '../constants.js';
import { BACKLOG } from '../data.js';

// equipo field value → GitHub logins (lowercase), for team-based hour distribution
export const EQUIPO_LOGINS = {
  "Equipo A":           TEAM_MEMBERS.filter(m => m.team === "A").map(m => m.login.toLowerCase()),
  "Equipo B":           TEAM_MEMBERS.filter(m => m.team === "B").map(m => m.login.toLowerCase()),
  "Equipo C":           TEAM_MEMBERS.filter(m => m.team === "C").map(m => m.login.toLowerCase()),
  "Equipo D":           TEAM_MEMBERS.filter(m => m.team === "D").map(m => m.login.toLowerCase()),
  "Equipo Presentación":["javiergutpas","nicogomezclaraco","mregidorgarcia","juancardesa","alereyper"],
  "Coordinadores":      ["carlosgallero","alereyper","mregidorgarcia","martarecio","igna0305","mjnizac"],
  "All":                TEAM_MEMBERS.map(m => m.login.toLowerCase()),
};

export const BACKLOG_MAP = (() => {
  const map = {};
  BACKLOG.forEach(it => {
    const baseH = SIZE_H_MAP[it.size] || 0;
    let estimated_h = baseH;
    if (it.area === "Asistencia" && baseH > 0) {
      let memberCount = 1;
      if (it.assignees && it.assignees.length > 0) {
        memberCount = it.assignees.length;
      } else if (it.equipo && EQUIPO_LOGINS[it.equipo]) {
        memberCount = EQUIPO_LOGINS[it.equipo].length;
      }
      estimated_h = baseH * memberCount;
    }
    map[it.id] = { ...it, estimated_h };
  });
  return map;
})();

// Compute assigned hours per login for a given sprint
export function computeSprintAssigned(sprintNum) {
  const m = {};
  BACKLOG.filter(i => i.sprint === sprintNum).forEach(item => {
    const h = SIZE_H_MAP[item.size] || 0;
    if (!h) return;
    const assignees = item.assignees || [];
    if (assignees.length > 0) {
      assignees.forEach(a => {
        const k = a.login.toLowerCase();
        m[k] = (m[k] || 0) + h;
      });
    } else if (item.equipo && EQUIPO_LOGINS[item.equipo]) {
      const members = EQUIPO_LOGINS[item.equipo];
      const hEach = +(h / members.length).toFixed(4);
      members.forEach(login => { m[login] = (m[login] || 0) + hEach; });
    }
  });
  return m;
}

// Assigned hours per login, keyed by sprint number
export const ASSIGNED_PER_SPRINT = {
  1: computeSprintAssigned(1),
  2: computeSprintAssigned(2),
  3: computeSprintAssigned(3),
};
