import readXlsxFile from 'read-excel-file/browser';
import Papa from 'papaparse';
import type { ActualTimeLog } from '../types';

/**
 * Helper to convert various date inputs (Date object, Excel serial, string formats) to YYYY-MM-DD
 */
export const formatDateToIso = (dateVal: any): string => {
  if (!dateVal) return new Date().toISOString().substring(0, 10);

  // If it's a native Date
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return new Date().toISOString().substring(0, 10);
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // If Excel Date Serial Number (e.g. 45000)
  if (typeof dateVal === 'number') {
    const jsDate = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    if (!isNaN(jsDate.getTime())) {
      const y = jsDate.getUTCFullYear();
      const m = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
      const d = String(jsDate.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // If String
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    
    // Check YYYY-MM-DD or YYYY/MM/DD
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(trimmed)) {
      const parts = trimmed.split(/[-/]/);
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // Check DD/MM/YYYY or DD-MM-YYYY
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(trimmed)) {
      const parts = trimmed.split(/[-/]/);
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }

    // Attempt native parse
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  return new Date().toISOString().substring(0, 10);
};

/**
 * Some exports arrive "double-CSV-encoded": every field was already
 * comma/quote-escaped once, then the whole line got treated as a single
 * text value and quoted/escaped again (typically from opening the real
 * Odoo CSV in Excel with the wrong delimiter setting, then re-saving it).
 * Papa.parse then reads each row as a single column containing the real,
 * still-quoted row as text. Detect that shape and re-run it through the
 * CSV parser to recover the real columns. If the project name itself has
 * a literal comma (not quoted in the original export), re-splitting can
 * produce more than 5 columns; the last 4 are always Fecha/Empleado/
 * Cantidad/Descripción, so anything before them is rejoined as the name.
 */
const unflattenRow = (row: any[]): any[] => {
  if (!row || row.length !== 1 || typeof row[0] !== 'string' || !row[0].includes(',')) return row;
  const reparsed = Papa.parse(row[0], { skipEmptyLines: true });
  const cols = (reparsed.data[0] as any[]) || [];
  if (cols.length < 4) return row;
  if (cols.length > 5) {
    const name = cols.slice(0, cols.length - 4).join(',');
    return [name, ...cols.slice(cols.length - 4)];
  }
  return cols;
};

/**
 * Parses an Excel (.xlsx, .xls) or CSV file containing time logs.
 * Columns expectation:
 * Col A (0): Project Name (referencial)
 * Col B (1): Date (Fecha)
 * Col C (2): Employee Name (Empleado)
 * Col D (3): Quantity / Hours (Cantidad - positive or negative)
 */
export const parseTimeTrackingFile = async (file: File): Promise<ActualTimeLog[]> => {
  const fileName = file.name.toLowerCase();
  let rawRows: any[][] = [];

  if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
    rawRows = await new Promise<any[][]>((resolve, reject) => {
      Papa.parse(file, {
        complete: (results) => resolve(results.data as any[][]),
        error: (err) => reject(err),
        skipEmptyLines: true,
      });
    });
  } else {
    // XLSX or XLS file
    try {
      const rows = await readXlsxFile(file);
      rawRows = rows as unknown as any[][];
    } catch (e) {
      console.warn("readXlsxFile error, falling back to CSV text parse", e);
      // Fallback CSV text parse if binary excel fails
      rawRows = await new Promise<any[][]>((resolve, reject) => {
        Papa.parse(file, {
          complete: (results) => resolve(results.data as any[][]),
          error: (err) => reject(err),
          skipEmptyLines: true,
        });
      });
    }
  }

  const logs: ActualTimeLog[] = [];
  const now = Date.now();

  for (let i = 0; i < rawRows.length; i++) {
    const row = unflattenRow(rawRows[i]);
    if (!row || row.length < 3) continue;

    const colA = row[0] ? String(row[0]).trim() : '';
    const colB = row[1];
    const colC = row[2] ? String(row[2]).trim() : '';
    const colD = row[3] !== undefined && row[3] !== null ? row[3] : row[2]; // Fallback if 3 cols
    const colE = row[4] !== undefined && row[4] !== null ? String(row[4]).trim() : '';

    // Skip header row if colD or colC is a text label like 'Cantidad', 'Horas', 'Empleado', etc.
    const colDStr = String(colD).trim().toLowerCase();
    const colCStr = String(colC).trim().toLowerCase();
    
    if (
      colDStr.includes('cantidad') || 
      colDStr.includes('horas') || 
      colDStr.includes('hours') || 
      colCStr.includes('empleado') ||
      colCStr.includes('employee') ||
      colDStr.includes('quantity')
    ) {
      continue;
    }

    // Parse hours (Col D or Col C if only 3 cols present and colD is numeric)
    let hours = NaN;
    if (typeof colD === 'number') {
      hours = colD;
    } else {
      const sanitized = String(colD).replace(',', '.').replace(/[^\d.-]/g, '');
      hours = parseFloat(sanitized);
    }

    // If Col D was not numeric, check if Col C had the hours (in case user uploaded Col A=Project, Col B=Fecha, Col C=Hours, Col D=Empleado)
    if (isNaN(hours) && typeof colC === 'number') {
      hours = colC;
    }

    if (isNaN(hours) || !colC || colCStr === '') continue;

    const formattedDate = formatDateToIso(colB);

    logs.push({
      id: `log-${now}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      projectNameRef: colA,
      date: formattedDate,
      employeeName: colC,
      hours: parseFloat(hours.toFixed(2)),
      description: colE || undefined,
    });
  }

  return logs;
};
