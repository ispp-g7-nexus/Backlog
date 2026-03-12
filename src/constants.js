export const MOSCOW_META = {
  M:{ label:"Must Have",   bg:"#dc2626", text:"#fff" },
  S:{ label:"Should Have", bg:"#b45309", text:"#fff" },
  C:{ label:"Could Have",  bg:"#0369a1", text:"#fff" },
  W:{ label:"Won't Have",  bg:"var(--bdr2)", text:"#fff" },
};

export const STATUS_META = {
  "Backlog":     { bg:"var(--bdr)", text:"var(--tx3)" },
  "Ready":       { bg:"var(--st-ready-bg)", text:"var(--st-ready-tx)" },
  "In progress": { bg:"var(--st-prog-bg)",  text:"var(--st-prog-tx)" },
  "In review":   { bg:"var(--st-rev-bg)",   text:"var(--st-rev-tx)" },
  "Done":        { bg:"var(--st-done-bg)",  text:"var(--st-done-tx)" },
};

export const SIZE_META = {
  XS:{ bg:"var(--sz-xs-bg)", text:"var(--sz-xs-tx)" },
  S: { bg:"var(--sz-s-bg)",  text:"var(--sz-s-tx)" },
  M: { bg:"var(--sz-m-bg)",  text:"var(--sz-m-tx)" },
  L: { bg:"var(--sz-l-bg)",  text:"var(--sz-l-tx)" },
  XL:{ bg:"var(--sz-xl-bg)", text:"var(--sz-xl-tx)" },
};

export const SC = {
  1:{ label:"Sprint 1", date:"19 feb–5 mar",  start:"2026-02-19", end:"2026-03-05", weight:"10%", color:"#818cf8" },
  2:{ label:"Sprint 2", date:"12 mar–26 mar",  start:"2026-03-12", end:"2026-03-26", weight:"15%", color:"#34d399" },
  3:{ label:"Sprint 3", date:"2 abr–16 abr",   start:"2026-04-02", end:"2026-04-16", weight:"30%", color:"#fbbf24" },
};

export const AREA_COLORS = [
  "#818cf8","#f472b6","#2dd4bf","#fb923c","#a78bfa",
  "#f87171","#38bdf8","#a3e635","#facc15","#c084fc","#4ade80","#60a5fa",
];

export const TABS = [
  { id:"github",   label:"🐙 GitHub",          color:"var(--tx2)" },
  { id:"project",  label:"📋 GitHub Project",  color:"#818cf8" },
  { id:"informe",  label:"⏱️ Clockify",         color:"#6ee7b7" },
  { id:"cal",      label:"📅 Calendario",       color:"#38bdf8" },
  { id:"costes",   label:"💰 Costes",           color:"#f97316" },
];

export const SIZE_H_MAP = { XS:2, S:4, M:8, L:16, XL:24 };

export const TEAM_MEMBERS = [
  { login:"mjnizac",          email:"mannizcob@alum.us.es",       name:"Manuel J. Niza Cobo",        role:"SM",  team:"B",  coord:true },
  { login:"mregidorgarcia",   email:"mregidorgarcia@gmail.com",   name:"Miguel Regidor García",      role:"PO",  team:"B",  coord:true },
  { login:"alereyper",        email:"alereyper@alum.us.es",       name:"Alejandro de los Reyes",     role:"Dev", team:"A",  coord:true },
  { login:"CarlosGallero",    email:"gallerolajara@gmail.com",     name:"Álvaro Carlos Gallero",      role:"Dev", team:"D",  coord:true },
  { login:"Igna0305",         email:"ignamartinezdiaz@gmail.com", name:"Ignacio Martínez Díaz",      role:"Dev", team:"B",  coord:true },
  { login:"MartaRecio",       email:"marrecgil@alum.us.es",       name:"Marta Recio Gil",            role:"Dev", team:"C",  coord:true },
  { login:"Javiergutpas",     email:"javgutpas@alum.us.es",       name:"Javier Gutiérrez Pastor",    role:"Dev", team:"A"             },
  { login:"Nuno1610",         email:"nundelesc@alum.us.es",       name:"Nuno del Pino Escalante",    role:"Dev", team:"A"             },
  { login:"javsorbla",        email:"javsorbla@alum.us.es",       name:"Javier Soria Blanco",        role:"Dev", team:"A"             },
  { login:"javcasrod1",       email:"javcasrod1@alum.us.es",      name:"Javier Castilla Rodríguez",  role:"Dev", team:"A"             },
  { login:"nicogomezclaraco", email:"nicogomezclaraco@gmail.com", name:"Nicolás Gómez Claraco",      role:"Dev", team:"B"             },
  { login:"JuanCardesa",      email:"juancardesasosa@gmail.com",  name:"Juan José Cardesa Sosa",     role:"Dev", team:"B"             },
  { login:"pausualin",        email:"pausualin@alum.us.es",       name:"Paula María Suárez Linares", role:"Dev", team:"C"             },
  { login:"celiasuaco",       email:"celsuacor@alum.us.es",       name:"Celia Suárez Córcoles",      role:"Dev", team:"C"             },
  { login:"cmurillog06",      email:"carmurgom@alum.us.es",       name:"Carmen Murillo Gómez",       role:"Dev", team:"C"             },
  { login:"olgacangom",       email:"olgcangom@alum.us.es",       name:"Olga Cano Gómez",            role:"Dev", team:"C"             },
  { login:"pabpergas",        email:"pabpergas@alum.us.es",       name:"Pablo Pérez Gaspar",         role:"Dev", team:"D"             },
  { login:"Albgarsan",        email:"albgarsan@alum.us.es",       name:"Alberto García San.",        role:"Dev", team:"D"             },
  { login:"angelmateos1",     email:"angmatmar@alum.us.es",       name:"Ángel Mateos Martínez",      role:"Dev", team:"D"             },
  { login:"pakillodecm",      email:"frademann@alum.us.es",       name:"frademann",                  role:"Dev", team:"D"             },
  { login:"JesusGarPer",      email:"jesgarper@alum.us.es",       name:"Jesús García Pérez",         role:"Dev", team:"D"             },
];

export const EQUIPO_LOGINS = {
  "Equipo A":           TEAM_MEMBERS.filter(m => m.team === "A").map(m => m.login.toLowerCase()),
  "Equipo B":           TEAM_MEMBERS.filter(m => m.team === "B").map(m => m.login.toLowerCase()),
  "Equipo C":           TEAM_MEMBERS.filter(m => m.team === "C").map(m => m.login.toLowerCase()),
  "Equipo D":           TEAM_MEMBERS.filter(m => m.team === "D").map(m => m.login.toLowerCase()),
  "Equipo Presentación":["javiergutpas","nicogomezclaraco","mregidorgarcia","juancardesa","alereyper"],
  "Coordinadores":      ["carlosgallero","alereyper","mregidorgarcia","martarecio","igna0305","mjnizac"],
  "All":                TEAM_MEMBERS.map(m => m.login.toLowerCase()),
};
