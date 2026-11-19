import { format } from 'date-fns';
import type { Point, Trip, Visit } from '../types';
import { COST_PER_KM } from '../types';

export interface HomeBase {
  name: string;
  region: string;
  address: string;
  lat: number;
  lng: number;
}

export interface SavedTripRoute {
  pointIds: string[];
  returnHome: boolean;
}

const HOME_STORAGE_KEY = 'uzmulk_home_base_v1';
const TRIP_ROUTES_STORAGE_KEY = 'uzmulk_trip_routes_v1';

export const DEFAULT_HOME_BASE: HomeBase = {
  name: 'Uy',
  region: 'Samarqand',
  address: 'Ziyolilar 6-uy',
  lat: 39.67123,
  lng: 66.84729,
};

export function loadHomeBase(): HomeBase {
  try {
    const raw = localStorage.getItem(HOME_STORAGE_KEY);
    if (!raw) return DEFAULT_HOME_BASE;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.name === 'string') {
      return {
        name: parsed.name || DEFAULT_HOME_BASE.name,
        region: parsed.region || DEFAULT_HOME_BASE.region,
        address: parsed.address || DEFAULT_HOME_BASE.address,
        lat: Number.isFinite(Number(parsed.lat)) ? Number(parsed.lat) : DEFAULT_HOME_BASE.lat,
        lng: Number.isFinite(Number(parsed.lng)) ? Number(parsed.lng) : DEFAULT_HOME_BASE.lng,
      };
    }
  } catch {}
  return DEFAULT_HOME_BASE;
}

export function saveHomeBase(home: HomeBase) {
  try {
    localStorage.setItem(HOME_STORAGE_KEY, JSON.stringify(home));
  } catch {}
}

export function loadAllTripRoutes(): Record<string, SavedTripRoute> {
  try {
    const raw = localStorage.getItem(TRIP_ROUTES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveTripRoute(tripId: string, route: SavedTripRoute) {
  try {
    const all = loadAllTripRoutes();
    all[tripId] = route;
    localStorage.setItem(TRIP_ROUTES_STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function detectRegion(name = '', address = ''): string {
  const s = `${name} ${address}`.toLowerCase();
  if (s.includes('джиззак') || s.includes('жиззах') || s.includes('jizzax') || s.includes('дустлик') || s.includes('пахтакор') || s.includes('арнасай') || s.includes('замин') || s.includes('бахмал') || s.includes('галляарал')) return 'Jizzax';
  if (s.includes('сырдар') || s.includes('сирдар') || s.includes('sirdaryo') || s.includes('мирзааб') || s.includes('mirzaobod') || s.includes('гулист') || s.includes('сайхун') || s.includes('янгиер') || s.includes('ширин')) return 'Sirdaryo';
  if (s.includes('самарканд') || s.includes('самарқанд') || s.includes('samarqand') || s.includes('каттакург') || s.includes('пастдарг') || s.includes('булунгур') || s.includes('тайлак') || s.includes('джамбай') || s.includes('нарпай') || s.includes('пахтачи') || s.includes('нуробод') || s.includes('ургут') || s.includes('иштыхан') || s.includes('пайарык') || s.includes('акдарь')) return 'Samarqand';
  if (s.includes('ташкент') || s.includes('тошкент') || s.includes('toshkent')) return 'Toshkent';
  if (s.includes('бухар') || s.includes('buxoro')) return 'Buxoro';
  if (s.includes('навои') || s.includes('navoiy')) return 'Navoiy';
  if (s.includes('кашкадар') || s.includes('қашқадар') || s.includes('qashqadaryo') || s.includes('карши') || s.includes('шахрисабз')) return 'Qashqadaryo';
  if (s.includes('сурхандар') || s.includes('surxondaryo') || s.includes('термез')) return 'Surxondaryo';
  if (s.includes('андижан') || s.includes('андижон') || s.includes('andijon')) return 'Andijon';
  if (s.includes('ферган') || s.includes('фарғона') || s.includes('farg')) return "Farg'ona";
  if (s.includes('наманган') || s.includes('namangan')) return 'Namangan';
  if (s.includes('хорезм') || s.includes('xorazm')) return 'Xorazm';
  return 'Samarqand';
}

function formatHours(seconds: number): string {
  const hrs = Math.max(0.1, Math.round((seconds / 3600) * 10) / 10);
  return `${hrs} soat`;
}

interface StopNode {
  name: string;
  region: string;
  address: string;
  lat: number;
  lng: number;
  coords: string;
}

function pointToStop(p: Point): StopNode {
  const hasCoords =
    typeof p.latitude === 'number' &&
    typeof p.longitude === 'number' &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude);
  return {
    name: p.name,
    region: detectRegion(p.name, p.address),
    address: p.address || '—',
    lat: hasCoords ? p.latitude : 39.67,
    lng: hasCoords ? p.longitude : 66.85,
    coords: hasCoords ? `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}` : '—',
  };
}

function homeToStop(home: HomeBase): StopNode {
  return {
    name: home.name,
    region: home.region,
    address: home.address,
    lat: home.lat,
    lng: home.lng,
    coords: `${home.lat.toFixed(6)}, ${home.lng.toFixed(6)}`,
  };
}

export async function exportTripsToStyledExcel(params: {
  trips: Trip[];
  visits: Visit[];
  points: Point[];
  periodLabel: string;
  fileName: string;
  workerName?: string;
}) {
  const { trips, visits, points, periodLabel, fileName, workerName } = params;
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'UzmulkTracker';
  wb.created = new Date();

  const ws = wb.addWorksheet('Safarlar hisoboti', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  const homeNode = homeToStop(loadHomeBase());
  const savedRoutes = loadAllTripRoutes();
  const pointsById = new Map(points.map((p) => [p.id, p]));

  // Group visits by YYYY-MM-DD in chronological order
  const visitsByDay = new Map<string, Visit[]>();
  const sortedVisits = [...visits].sort(
    (a, b) => new Date(a.visited_at).getTime() - new Date(b.visited_at).getTime()
  );
  for (const v of sortedVisits) {
    const dayKey = format(new Date(v.visited_at), 'yyyy-MM-dd');
    const arr = visitsByDay.get(dayKey) || [];
    arr.push(v);
    visitsByDay.set(dayKey, arr);
  }

  // Sort trips chronologically
  const sortedTrips = [...trips].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );

  // Build full list of legs across all trips
  interface ExcelLeg {
    startDt: Date;
    endDt: Date;
    from: StopNode;
    to: StopNode;
    durationS: number;
    km: number;
  }

  const allLegs: ExcelLeg[] = [];

  for (const trip of sortedTrips) {
    const startMs = new Date(trip.started_at).getTime();
    const endMs = trip.ended_at ? new Date(trip.ended_at).getTime() : startMs + 3600_000;
    const totalDurationS = Math.max(600, trip.total_duration_s || Math.floor((endMs - startMs) / 1000));
    const totalTripKm = Number(((trip.total_distance_m || 0) / 1000).toFixed(1));
    const dayKey = format(new Date(trip.started_at), 'yyyy-MM-dd');

    // 1. Determine ordered branch stops for this trip:
    //    Priority A: explicit route stops saved on this trip
    //    Priority B: all unique branches visited on this day (chronologically)
    let stopPoints: Point[] = [];
    let returnHome = true;

    const saved = savedRoutes[trip.id];
    if (saved && saved.pointIds.length > 0) {
      stopPoints = saved.pointIds
        .map((id) => pointsById.get(id))
        .filter((p): p is Point => !!p);
      returnHome = saved.returnHome;
    } else {
      const dayVisits = visitsByDay.get(dayKey) || [];
      const seen = new Set<string>();
      for (const v of dayVisits) {
        const pt = v.point || (v.point_id ? pointsById.get(v.point_id) : undefined);
        if (pt && !seen.has(pt.id)) {
          seen.add(pt.id);
          stopPoints.push(pt);
        }
      }
    }

    // Build stop chain: Home -> Stop 1 -> Stop 2 -> ... -> Home
    const chain: StopNode[] = [homeNode];
    if (stopPoints.length > 0) {
      for (const pt of stopPoints) {
        chain.push(pointToStop(pt));
      }
      if (returnHome) {
        chain.push(homeNode);
      }
    } else {
      // No visits or stops recorded for this day: single placeholder leg
      chain.push({
        name: 'Kadastr filiali',
        region: homeNode.region,
        address: '—',
        lat: homeNode.lat,
        lng: homeNode.lng,
        coords: '—',
      });
    }

    // Split total distance & time proportionally across legs by Haversine distance
    const legCount = chain.length - 1;
    const rawWeights: number[] = [];
    for (let i = 0; i < legCount; i++) {
      const d = haversineKm(chain[i].lat, chain[i].lng, chain[i + 1].lat, chain[i + 1].lng);
      rawWeights.push(d > 0.2 ? d : 1);
    }
    const weightSum = rawWeights.reduce((s, w) => s + w, 0) || legCount;

    let remainingKm = totalTripKm;
    let cursorMs = startMs;

    for (let i = 0; i < legCount; i++) {
      const ratio = rawWeights[i] / weightSum;
      const legKm =
        i === legCount - 1
          ? Math.max(0, Number(remainingKm.toFixed(1)))
          : Number((totalTripKm * ratio).toFixed(1));
      remainingKm -= legKm;

      const legDurationS = Math.max(300, Math.round(totalDurationS * ratio));
      const legStart = new Date(cursorMs);
      const legEnd = new Date(i === legCount - 1 ? Math.max(cursorMs + 300_000, endMs) : cursorMs + legDurationS * 1000);
      cursorMs = legEnd.getTime();

      allLegs.push({
        startDt: legStart,
        endDt: legEnd,
        from: chain[i],
        to: chain[i + 1],
        durationS: legDurationS,
        km: legKm,
      });
    }
  }

  const totalKm = sortedTrips.reduce((s, t) => s + (t.total_distance_m || 0) / 1000, 0);
  const totalComp = sortedTrips.reduce((s, t) => s + (t.compensation_uzs || 0), 0);

  // Column widths matching all 13 columns of Yangi_safarlar_muallif.xlsx
  ws.columns = [
    { key: 'num', width: 10 },
    { key: 'startDt', width: 20 },
    { key: 'fromName', width: 28 },
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
  subCell.value = `Jami yo'nalishlar: ${allLegs.length} ta   |   Jami masofa: ${totalKm.toFixed(1)} km   |   Kompensatsiya (${COST_PER_KM.toLocaleString('ru-RU')} so'm/km): ${totalComp.toLocaleString('ru-RU')} so'm`;
  subCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E3A5F' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F8' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 22;

  ws.getRow(3).height = 8;

  // Row 4: Table Headers
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

  allLegs.forEach((leg, idx) => {
    const row = ws.addRow([
      idx + 1,
      format(leg.startDt, 'dd.MM.yyyy HH:mm'),
      leg.from.name,
      leg.from.region,
      leg.from.address,
      leg.from.coords,
      format(leg.endDt, 'dd.MM.yyyy HH:mm'),
      leg.to.name,
      leg.to.region,
      leg.to.address,
      leg.to.coords,
      formatHours(leg.durationS),
      leg.km,
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
  const lastDataRow = 4 + allLegs.length;
  const totalRow = ws.addRow([
    '',
    'JAMI',
    '',
    '',
    '',
    '',
    '',
    `Jami yo'nalishlar: ${allLegs.length} ta`,
    '',
    '',
    '',
    `${totalComp.toLocaleString('ru-RU')} so'm`,
    { formula: allLegs.length > 0 ? `SUM(M5:M${lastDataRow})` : '0', result: Number(totalKm.toFixed(1)) },
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
