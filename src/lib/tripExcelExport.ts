import { format } from 'date-fns';
import type { Trip, Visit } from '../types';
import { COST_PER_KM } from '../types';

const HOME_BASE = {
  name: 'Uy',
  region: 'Samarqand',
  address: 'Ziyolilar 6-uy',
  coords: '39.671230, 66.847290',
};

function detectRegion(name = '', address = ''): string {
  const s = `${name} ${address}`.toLowerCase();
  if (s.includes('джиззак') || s.includes('жиззах') || s.includes('jizzax') || s.includes('дустлик') || s.includes('пахтакор')) return 'Jizzax';
  if (s.includes('сырдар') || s.includes('сирдар') || s.includes('sirdaryo') || s.includes('мирзааб') || s.includes('mirzaobod')) return 'Sirdaryo';
  if (s.includes('самарканд') || s.includes('самарқанд') || s.includes('samarqand')) return 'Samarqand';
  if (s.includes('ташкент') || s.includes('тошкент') || s.includes('toshkent')) return 'Toshkent';
  if (s.includes('бухар') || s.includes('buxoro')) return 'Buxoro';
  if (s.includes('навои') || s.includes('navoiy')) return 'Navoiy';
  if (s.includes('кашкадар') || s.includes('қашқадар') || s.includes('qashqadaryo')) return 'Qashqadaryo';
  if (s.includes('сурхандар') || s.includes('surxondaryo')) return 'Surxondaryo';
  if (s.includes('андижан') || s.includes('андижон') || s.includes('andijon')) return 'Andijon';
  if (s.includes('ферган') || s.includes('фарғона') || s.includes('farg')) return 'Farg\'ona';
  if (s.includes('наманган') || s.includes('namangan')) return 'Namangan';
  if (s.includes('хорезм') || s.includes('xorazm')) return 'Xorazm';
  return 'Samarqand';
}

function formatHours(seconds?: number): string {
  if (!seconds || seconds <= 0) return '1.0 soat';
  const hrs = Math.round((seconds / 3600) * 10) / 10;
  return `${hrs} soat`;
}

export async function exportTripsToStyledExcel(params: {
  trips: Trip[];
  visits: Visit[];
  periodLabel: string;
  fileName: string;
  workerName?: string;
}) {
  const { trips, visits, periodLabel, fileName, workerName } = params;
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'UzmulkTracker';
  wb.created = new Date();

  const ws = wb.addWorksheet('Safarlar hisoboti', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  // Group visits by YYYY-MM-DD so we can auto-fill destination names, regions, addresses & coords
  const visitsByDay = new Map<string, Visit[]>();
  for (const v of visits) {
    const dayKey = format(new Date(v.visited_at), 'yyyy-MM-dd');
    const arr = visitsByDay.get(dayKey) || [];
    arr.push(v);
    visitsByDay.set(dayKey, arr);
  }

  // Sort trips chronologically (oldest -> newest, like Yangi_safarlar_muallif.xlsx)
  const sortedTrips = [...trips].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );

  const totalKm = sortedTrips.reduce((s, t) => s + (t.total_distance_m || 0) / 1000, 0);
  const totalComp = sortedTrips.reduce((s, t) => s + (t.compensation_uzs || 0), 0);

  // Column widths matching all 13 columns of Yangi_safarlar_muallif.xlsx
  ws.columns = [
    { key: 'num', width: 10 },
    { key: 'startDt', width: 20 },
    { key: 'fromName', width: 26 },
    { key: 'fromRegion', width: 15 },
    { key: 'fromAddr', width: 22 },
    { key: 'fromCoords', width: 22 },
    { key: 'endDt', width: 20 },
    { key: 'toName', width: 32 },
    { key: 'toRegion', width: 15 },
    { key: 'toAddr', width: 24 },
    { key: 'toCoords', width: 22 },
    { key: 'duration', width: 16 },
    { key: 'distance', width: 15 },
  ];

  // Row 1: Executive Title Banner
  ws.mergeCells('A1:M1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `SAFARLAR VA MASOFA HISOBOTI — ${periodLabel.toUpperCase()}${workerName ? ` (${workerName})` : ''}`;
  titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 30;

  // Row 2: KPI Subtitle
  ws.mergeCells('A2:M2');
  const subCell = ws.getCell('A2');
  subCell.value = `Jami safarlar: ${sortedTrips.length} ta   |   Jami masofa: ${totalKm.toFixed(1)} km   |   Kompensatsiya (${COST_PER_KM.toLocaleString('ru-RU')} so'm/km): ${totalComp.toLocaleString('ru-RU')} so'm`;
  subCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E3A5F' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F8' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 22;

  // Row 3: Empty spacer
  ws.getRow(3).height = 8;

  // Row 4: Table Headers (exact column names from Yangi_safarlar_muallif.xlsx)
  const headers = [
    'Tartib raqami',
    'Boshlanish sanasi va vaqti',
    'Qayerdan Nomi',
    'Qayerdan Viloyat',
    'Qayerdan Manzil',
    'Qayerdan Koordinatalari',
    'Tugash sanasi va vaqti',
    'Qayerga Nomi',
    'Qayerga Viloyat',
    'Qayerga Manzil',
    'Qayerga Koordinatalari',
    'Jami sarflangan vaqt',
    'Jami masofa',
  ];

  const headerRow = ws.getRow(4);
  headerRow.values = headers;
  headerRow.height = 32;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1D4ED8' } },
      bottom: { style: 'medium', color: { argb: 'FF1E3A5F' } },
      left: { style: 'thin', color: { argb: 'FF60A5FA' } },
      right: { style: 'thin', color: { argb: 'FF60A5FA' } },
    };
  });

  ws.autoFilter = 'A4:M4';

  const thinBorder = {
    top: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
  };

  // Data Rows
  sortedTrips.forEach((trip, idx) => {
    const startDate = new Date(trip.started_at);
    const endDate = trip.ended_at ? new Date(trip.ended_at) : startDate;
    const dayKey = format(startDate, 'yyyy-MM-dd');
    const dayVisits = visitsByDay.get(dayKey) || [];
    const primaryPoint = dayVisits[0]?.point;

    const toName = primaryPoint?.name || 'Kadastr filiali';
    const toRegion = primaryPoint ? detectRegion(primaryPoint.name, primaryPoint.address) : HOME_BASE.region;
    const toAddr = primaryPoint?.address || '—';
    const toCoords =
      primaryPoint && typeof primaryPoint.latitude === 'number' && typeof primaryPoint.longitude === 'number'
        ? `${primaryPoint.latitude.toFixed(6)}, ${primaryPoint.longitude.toFixed(6)}`
        : '—';

    const kmVal = Number(((trip.total_distance_m || 0) / 1000).toFixed(1));
    const row = ws.addRow([
      idx + 1,
      format(startDate, 'dd.MM.yyyy HH:mm'),
      HOME_BASE.name,
      HOME_BASE.region,
      HOME_BASE.address,
      HOME_BASE.coords,
      format(endDate, 'dd.MM.yyyy HH:mm'),
      toName,
      toRegion,
      toAddr,
      toCoords,
      formatHours(trip.total_duration_s),
      kmVal,
    ]);

    row.height = 24;
    const isZebra = idx % 2 === 1;

    row.eachCell((cell, colNum) => {
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: colNum === 1 || colNum === 13,
        color: { argb: colNum === 13 ? 'FF1D4ED8' : 'FF1E293B' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isZebra ? 'FFF8FAFC' : 'FFFFFFFF' },
      };
      cell.border = thinBorder;
      cell.alignment = {
        vertical: 'middle',
        horizontal:
          colNum === 1 || colNum === 2 || colNum === 6 || colNum === 7 || colNum === 11 || colNum === 12
            ? 'center'
            : colNum === 13
            ? 'right'
            : 'left',
        wrapText: true,
      };
      if (colNum === 13) {
        cell.numFmt = '0.0';
      }
    });
  });

  // Total Summary Row
  const lastDataRow = 4 + sortedTrips.length;
  const totalRow = ws.addRow([
    '',
    'JAMI',
    '',
    '',
    '',
    '',
    '',
    `Jami safarlar: ${sortedTrips.length} ta`,
    '',
    '',
    '',
    `${totalComp.toLocaleString('ru-RU')} so'm`,
    { formula: sortedTrips.length > 0 ? `SUM(M5:M${lastDataRow})` : '0', result: Number(totalKm.toFixed(1)) },
  ]);
  totalRow.height = 28;
  totalRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF065F46' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
    cell.border = {
      top: { style: 'double', color: { argb: 'FF10B981' } },
      bottom: { style: 'medium', color: { argb: 'FF10B981' } },
      left: { style: 'thin', color: { argb: 'FFA7F3D0' } },
      right: { style: 'thin', color: { argb: 'FFA7F3D0' } },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: colNum === 13 ? 'right' : colNum === 2 || colNum === 12 ? 'center' : 'left',
    };
    if (colNum === 13) {
      cell.numFmt = '0.0 "km"';
    }
  });

  // Generate browser download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
