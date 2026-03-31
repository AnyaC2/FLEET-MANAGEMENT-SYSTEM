import * as XLSX from 'xlsx';

export type ExportCell = string | number | boolean | null | undefined;
export type ExportRow = Record<string, ExportCell>;

export function exportWorkbook(options: {
  filename: string;
  sheets: Array<{
    name: string;
    rows: ExportRow[];
  }>;
}) {
  const workbook = XLSX.utils.book_new();

  for (const sheet of options.sheets) {
    const rows = sheet.rows.length > 0 ? sheet.rows : [{ Info: 'No records found' }];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }

  XLSX.writeFile(workbook, options.filename.endsWith('.xlsx') ? options.filename : `${options.filename}.xlsx`);
}

export function safeDateLabel(value = new Date()) {
  return value.toISOString().split('T')[0];
}
