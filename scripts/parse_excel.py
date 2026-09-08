import re
import openpyxl

def dms_to_decimal(dms_str):
    """Convert DMS to decimal. Handles commas, curly quotes, Cyrillic."""
    if not dms_str:
        return None
    s = dms_str.strip().replace('\xa0', ' ')
    # Normalize curly quotes to straight
    s = s.replace('\u2018', "'").replace('\u2019', "'").replace('\u201C', '"').replace('\u201D', '"')
    # Normalize Cyrillic С (looks like Latin C but is different) to S for south
    # Actually Cyrillic С = U+0421, let's just handle it in direction detection
    
    # Try DMS: degrees°minutes'seconds"Direction
    m = re.search(r"(\d+)[°]\s*(\d+)['\u2019]\s*([\d,.]+)[\"\u201D]?\s*([NSEWСВсвnsew])", s, re.IGNORECASE)
    if m:
        deg = float(m.group(1))
        minutes = float(m.group(2))
        sec_str = m.group(3).replace(',', '.')
        seconds = float(sec_str)
        direction = m.group(4).upper()
        decimal = deg + minutes / 60 + seconds / 3600
        if direction in ('S', 'W'):
            decimal = -abs(decimal)
        return round(decimal, 6)
    
    # Try DM: degrees°minutesDirection (minutes might have comma decimal)
    m = re.search(r"(\d+)[°]\s*([\d,.]+)[\"\u201D]?\s*([NSEWСВсвnsew])", s, re.IGNORECASE)
    if m:
        deg = float(m.group(1))
        min_str = m.group(2).replace(',', '.')
        minutes = float(min_str)
        direction = m.group(3).upper()
        decimal = deg + minutes / 60
        if direction in ('S', 'W'):
            decimal = -abs(decimal)
        return round(decimal, 6)
    
    return None

def parse_location(loc_str):
    """Parse location string with lat and lon"""
    if not loc_str:
        return None, None
    s = loc_str.strip().replace('\xa0', ' ')
    # Normalize quotes
    s = s.replace('\u2018', "'").replace('\u2019', "'").replace('\u201C', '"').replace('\u201D', '"')
    # Don't replace commas blindly - they might be decimal separators in seconds
    # Instead, find segments first
    
    # Find all DMS segments
    segments = re.findall(r"\d+[°]\s*\d+['\u2019]\s*[\d,.]+[\"\u201D]?\s*[NSEWСВсвnsew]", s, re.IGNORECASE)
    if not segments:
        segments = re.findall(r"\d+[°]\s*[\d,.]+[\"\u201D]?\s*[NSEWСВсвnsew]", s, re.IGNORECASE)
    
    lat = None
    lon = None
    for seg in segments:
        val = dms_to_decimal(seg)
        if val is None:
            continue
        upper = seg.upper()
        # Determine lat or lon by direction
        # N/S = latitude, E/W = longitude
        # Cyrillic С = Север (North), В = Восток (East)
        has_n = 'N' in upper
        has_s = 'S' in upper
        has_e = 'E' in upper
        has_w = 'W' in upper
        has_cyr_s = '\u0421' in upper or '\u0441' in upper
        has_cyr_v = '\u0412' in upper or '\u0432' in upper
        
        if has_n or has_cyr_s:
            lat = val  # North
        elif has_s:
            lat = -abs(val)  # South
        elif has_e or has_cyr_v:
            lon = val  # East
        elif has_w:
            lon = -abs(val)  # West
    
    return lat, lon

# Translation map
uz_to_ru = {
    'Самарқанд вилояти': 'Самаркандская область',
    'Сирдарё вилояти': 'Сырдарьинская область',
    'Жиззах вилояти': 'Джиззакская область',
    'Бошқарма': 'Управление',
    'Марказий аппарат': 'Центральный аппарат',
    'Самарқанд шаҳар': 'г. Самарканд',
    'Самарқанд шаҳри': 'г. Самарканд',
    'Тайлоқ тумани': 'Тайлакский район',
    'Каттақўрғон шаҳар': 'г. Каттакурган',
    'Каттақўрғон шаҳри': 'г. Каттакурган',
    'Каттақўрғон тумани': 'Каттакурганский район',
    'Оқдарё тумани': 'Акдарьинский район',
    'Булунғур тумани': 'Булунгурский район',
    'Жомбой тумани': 'Джамбайский район',
    'Иштихон тумани': 'Иштиханский район',
    'Қўшработ тумани': 'Кушрабадский район',
    'Нарпай тумани': 'Нарпайский район',
    'Паяриқ тумани': 'Пайарыкский район',
    'Пастдарғом тумани': 'Пастдаргомский район',
    'Пахтачи тумани': 'Пахтачинский район',
    'Нуробод тумани': 'Нурободский район',
    'Ургут тумани': 'Ургутский район',
    'Оқолтин тумани': 'Акалтынский район',
    'Боёвут тумани': 'Баяутский район',
    'Гулистон тумани': 'Гулистанский район',
    'Мирзаобод тумани': 'Мирзаабадский район',
    'Сайхунобод тумани': 'Сайхунабадский район',
    'Сирдарё тумани': 'Сырдарьинский район',
    'Ховос тумани': 'Хавасский район',
    'Сардоба тумани': 'Сардобинский район',
    'Гулистон шаҳар': 'г. Гулистан',
    'Ширин шаҳар': 'г. Ширин',
    'Янгиер шаҳар': 'г. Янгиер',
    'Арнасой тумани': 'Арнасайский район',
    'Бахмал тумани': 'Бахмальский район',
    'Ғаллаорол тумани': 'Галляаральский район',
    'Шароф Рашидов тумани': 'Шараф-Рашидовский район',
    'Дўстлик тумани': 'Дустликский район',
    'Зарбдор тумани': 'Зарбдарский район',
    'Зомин тумани': 'Заминский район',
    'Зафаробод тумани': 'Зафарабадский район',
    'Мирзачўл тумани': 'Мирзачульский район',
    'Пахтакор тумани': 'Пахтакорский район',
    'Фориш тумани': 'Фаришский район',
    'Жиззах шаҳар': 'г. Джиззах',
    'Жиззах шаҳри': 'г. Джиззах',
    'Янгиобод тумани': 'Янгиабадский район',
    'Самарқанд тумани': 'Самаркандский район',
}

wb = openpyxl.load_workbook(r'C:\Users\Tolmas\Desktop\Samarqand, Jizzax va Sirdaryo.xlsx')
ws = wb['Филиаллар контактлари']

points = []
current_region = ''
failed = []

for row in ws.iter_rows(min_row=3, max_row=ws.max_row, values_only=True):
    num, name, formal_name, address, index_addr, location, phone = row
    if not name:
        continue
    name_str = str(name).strip()
    if not formal_name or str(formal_name).strip() == '':
        current_region = uz_to_ru.get(name_str, name_str)
        continue
    if name_str == 'Худудий бошқармалар туман шаҳар номи':
        continue
    
    loc_raw = str(location) if location else ''
    lat, lon = parse_location(loc_raw)
    
    if lat is None or lon is None:
        failed.append(f"  {name_str}: {loc_raw}")
        continue
    
    ru_name = uz_to_ru.get(name_str, name_str)
    ru_region = uz_to_ru.get(current_region, current_region)
    full_name = f"{ru_name} ({ru_region})"
    phone_str = str(phone).strip() if phone else ''
    addr_raw = str(address).strip() if address else ''
    # Sanitize address: remove newlines, normalize spaces
    addr_raw = addr_raw.replace('\n', ' ').replace('\r', ' ').replace('  ', ' ').strip()
    
    points.append({
        'name': full_name,
        'address': addr_raw,
        'lat': lat,
        'lon': lon,
        'phone': phone_str,
        'notes': f"Тел: {phone_str}" if phone_str else '',
        'region': ru_region,
    })

print(f"Total points parsed: {len(points)}")
if failed:
    print(f"\nFailed ({len(failed)}):")
    for f in failed:
        print(f)

# Generate SQL
lines = []
lines.append("-- Auto-generated from Excel: Samarqand, Jizzax va Sirdaryo")
lines.append("-- All names translated from Uzbek to Russian")
lines.append("-- Status: unknown (not visited yet)")
lines.append("")
lines.append("INSERT INTO points (name, address, latitude, longitude, status, notes, worker_id) VALUES")

values = []
for p in points:
    n = p["name"].replace("'", "''")
    a = p["address"].replace("'", "''")
    no = p["notes"].replace("'", "''")
    values.append(f"  ('{n}', '{a}', {p['lat']}, {p['lon']}, 'unknown', '{no}', NULL)")

lines.append(",\n".join(values) + ";")

sql = "\n".join(lines)
with open(r'C:\Users\Tolmas\service-tracker\supabase\seed_points.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

print(f"\nSQL written to supabase/seed_points.sql ({len(points)} points)")
print()
for i, p in enumerate(points, 1):
    print(f"{i:2d}. {p['name']}")
    print(f"    {p['lat']}, {p['lon']} | {p['phone']}")
