import * as XLSX from "xlsx";

export type LeadHygieneResult = {
  total: number;
  valid: string[];
  invalid: string[];
  duplicates: number;
};

const PHONE_RE = /^55\d{2}9?\d{8}$/;

export function onlyDigits(value: string) {
  return value.replace(/\D+/g, "");
}

export function classifyPhones(raw: string): LeadHygieneResult {
  const lines = raw
    .split(/[\s,;]+/g)
    .map((line) => onlyDigits(line))
    .filter(Boolean);
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;

  for (let phone of lines) {
    if (!phone.startsWith("55")) phone = `55${phone}`;
    if (!PHONE_RE.test(phone)) {
      invalid.push(phone);
      continue;
    }
    if (seen.has(phone)) {
      duplicates += 1;
      continue;
    }
    seen.add(phone);
    valid.push(phone);
  }

  return { total: lines.length, valid, invalid, duplicates };
}

export async function readLeadFile(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    return workbook.SheetNames
      .map((sheetName) => XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { FS: "\n" }))
      .join("\n");
  }
  return file.text();
}

export function downloadCsv(filename: string, rows: string[]) {
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}