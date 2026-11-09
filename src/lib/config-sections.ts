export type FieldType = "text" | "number" | "bool" | "date" | "select" | "enum";

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  ref?: { table: string; select: string; label: (r: Record<string, unknown>) => string };
  options?: { value: string; label: string }[];
};

export type Section = { slug: string; title: string; table: string; order: string; fields: Field[] };

const yearRef = { table: "school_years", select: "id, emer", label: (r: Record<string, unknown>) => String(r["emer"]) };
const deptRef = { table: "departments", select: "id, emer", label: (r: Record<string, unknown>) => String(r["emer"]) };
const currRef = { table: "curricula", select: "id, kod, emer", label: (r: Record<string, unknown>) => `${r["kod"]} – ${r["emer"]}` };
const classRef = { table: "class_groups", select: "id, emer", label: (r: Record<string, unknown>) => String(r["emer"]) };
const teacherRef = { table: "teachers", select: "id, emer, mbiemer", label: (r: Record<string, unknown>) => `${r["emer"]} ${r["mbiemer"] ?? "(mbiemri për konfigurim)"}` };
const subjectRef = { table: "subjects", select: "id, emer, klasa_nivel", label: (r: Record<string, unknown>) => `${r["emer"]}${r["klasa_nivel"] ? ` (kl. ${r["klasa_nivel"]})` : ""}` };
const labRef = { table: "laboratories", select: "id, emer", label: (r: Record<string, unknown>) => String(r["emer"]) };

export const SECTIONS: Section[] = [
  { slug: "vitet", title: "Vitet shkollore", table: "school_years", order: "emer", fields: [
    { key: "emer", label: "Emri", type: "text", required: true },
    { key: "data_fillimi", label: "Fillimi", type: "date" },
    { key: "data_mbarimi", label: "Mbarimi", type: "date" },
    { key: "aktiv", label: "Aktiv", type: "bool" },
  ] },
  { slug: "departamentet", title: "Departamentet", table: "departments", order: "emer", fields: [
    { key: "kod", label: "Kodi", type: "text", required: true },
    { key: "emer", label: "Emri", type: "text", required: true },
  ] },
  { slug: "kurrikulat", title: "Skeletkurrikulat", table: "curricula", order: "kod", fields: [
    { key: "kod", label: "Kodi", type: "text", required: true },
    { key: "emer", label: "Emri", type: "text", required: true },
    { key: "department_id", label: "Departamenti", type: "select", required: true, ref: deptRef },
    { key: "drejtimi", label: "Drejtimi", type: "text" },
    { key: "profili", label: "Profili", type: "text" },
    { key: "niveli", label: "Niveli", type: "text" },
    { key: "shenim", label: "Shënim", type: "text" },
  ] },
  { slug: "lendet", title: "Lëndët / modulet", table: "subjects", order: "emer", fields: [
    { key: "emer", label: "Emri", type: "text", required: true },
    { key: "kod", label: "Kodi", type: "text" },
    { key: "curriculum_id", label: "Skeletkurrikula", type: "select", ref: currRef },
    { key: "lloji", label: "Lloji", type: "enum", options: [
      { value: "teori_pergjithshme", label: "Teori e përgjithshme" },
      { value: "teori_profesionale", label: "Teori profesionale" },
      { value: "praktike_profesionale", label: "Praktikë profesionale" },
    ] },
    { key: "klasa_nivel", label: "Klasa", type: "number" },
  ] },
  { slug: "klasat", title: "Grupet e klasave", table: "class_groups", order: "emer", fields: [
    { key: "emer", label: "Emri (p.sh. 10-A)", type: "text", required: true },
    { key: "nivel", label: "Niveli (10–13)", type: "number", required: true },
    { key: "school_year_id", label: "Viti", type: "select", required: true, ref: yearRef },
    { key: "department_id", label: "Departamenti", type: "select", ref: deptRef },
    { key: "curriculum_id", label: "Skeletkurrikula / profili", type: "select", ref: currRef },
  ] },
  { slug: "laboratoret", title: "Laboratorët", table: "laboratories", order: "emer", fields: [
    { key: "emer", label: "Emri", type: "text", required: true },
    { key: "department_id", label: "Departamenti", type: "select", ref: deptRef },
    { key: "pershkrim", label: "Përshkrimi", type: "text" },
  ] },
  { slug: "mesuesit", title: "Mësuesit", table: "teachers", order: "emer", fields: [
    { key: "emer", label: "Emri", type: "text", required: true },
    { key: "mbiemer", label: "Mbiemri", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "department_id", label: "Departamenti", type: "select", ref: deptRef },
    { key: "lendet_sipas_listes", label: "Lëndët sipas listës", type: "text" },
    { key: "aktiv", label: "Aktiv", type: "bool" },
  ] },
  { slug: "caktimet", title: "Caktimet mësimore", table: "teaching_assignments", order: "created_at", fields: [
    { key: "teacher_id", label: "Mësuesi", type: "select", required: true, ref: teacherRef },
    { key: "school_year_id", label: "Viti", type: "select", required: true, ref: yearRef },
    { key: "class_group_id", label: "Klasa", type: "select", required: true, ref: classRef },
    { key: "subject_id", label: "Lënda / moduli", type: "select", required: true, ref: subjectRef },
    { key: "aktiv", label: "Aktiv", type: "bool" },
  ] },
  { slug: "kujdestarite", title: "Kujdestaritë", table: "homeroom_assignments", order: "created_at", fields: [
    { key: "teacher_id", label: "Mësuesi", type: "select", required: true, ref: teacherRef },
    { key: "school_year_id", label: "Viti", type: "select", required: true, ref: yearRef },
    { key: "class_group_id", label: "Klasa", type: "select", required: true, ref: classRef },
    { key: "aktiv", label: "Aktiv", type: "bool" },
  ] },
  { slug: "caktime-lab", title: "Caktimet në laborator", table: "lab_assignments", order: "created_at", fields: [
    { key: "teacher_id", label: "Mësuesi", type: "select", required: true, ref: teacherRef },
    { key: "school_year_id", label: "Viti", type: "select", required: true, ref: yearRef },
    { key: "laboratory_id", label: "Laboratori", type: "select", required: true, ref: labRef },
    { key: "aktiv", label: "Aktiv", type: "bool" },
  ] },
  { slug: "kategorite", title: "Kategoritë e artikujve", table: "categories", order: "emer", fields: [
    { key: "emer", label: "Emri", type: "text", required: true },
    { key: "parent_id", label: "Kategoria prind", type: "select", ref: { table: "categories", select: "id, emer", label: (r: Record<string, unknown>) => String(r["emer"]) } },
  ] },
  { slug: "njesite", title: "Njësitë", table: "units", order: "kod", fields: [
    { key: "kod", label: "Kodi", type: "text", required: true },
    { key: "emer", label: "Emri", type: "text", required: true },
  ] },
];
