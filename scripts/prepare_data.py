from pathlib import Path
import csv
import json
from collections import defaultdict

# -----------------------------------------
# AJMAN ECO-PULSE — DATA PREPARATION
# -----------------------------------------

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"

PROCESSED.mkdir(parents=True, exist_ok=True)

DISTRICT_CSV = RAW / "waste-composition-by-district.csv"
DISTRICT_GEOJSON = RAW / "waste-composition-by-district.geojson"
HISTORY_CSV = RAW / "quantity-of-liquid-and-solid-wastes.csv"


def read_csv(path):
    """Read an Ajman Data CSV while preserving the original fields."""
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


# -----------------------------------------
# 1. LOAD RAW DATA
# -----------------------------------------

district_rows = read_csv(DISTRICT_CSV)
history_rows = read_csv(HISTORY_CSV)

with DISTRICT_GEOJSON.open("r", encoding="utf-8-sig") as f:
    geojson = json.load(f)

print("\nAJMAN ECO-PULSE — DATA VALIDATION")
print("=" * 45)

print(f"District composition rows : {len(district_rows)}")
print(f"Historical waste rows     : {len(history_rows)}")
print(f"GeoJSON features          : {len(geojson.get('features', []))}")


# -----------------------------------------
# 2. INSPECT COLUMN NAMES
# -----------------------------------------

print("\nDistrict dataset columns:")
for column in district_rows[0]:
    print(" •", repr(column))

print("\nHistorical dataset columns:")
for column in history_rows[0]:
    print(" •", repr(column))


# -----------------------------------------
# 3. SAVE CLEAN GEOJSON COPY
# -----------------------------------------

geo_output = PROCESSED / "district-map.geojson"

with geo_output.open("w", encoding="utf-8") as f:
    json.dump(
        geojson,
        f,
        ensure_ascii=False,
        separators=(",", ":")
    )

print(f"\n✓ GeoJSON prepared: {geo_output.name}")


# -----------------------------------------
# 4. CREATE DATA QUALITY REPORT
# -----------------------------------------

report = {
    "project": "Ajman Eco-Pulse",
    "sources": {
        "district_composition": DISTRICT_CSV.name,
        "historical_waste": HISTORY_CSV.name,
        "district_geography": DISTRICT_GEOJSON.name
    },
    "raw_row_counts": {
        "district_composition": len(district_rows),
        "historical_waste": len(history_rows),
        "geojson_features": len(geojson.get("features", []))
    },
    "notes": [
        "Raw source files are preserved unchanged.",
        "Processed files are generated separately.",
        "Historical duplicate observations require validation before removal.",
        "No ambiguous historical values are automatically discarded."
    ]
}

report_path = PROCESSED / "data-quality-report.json"

with report_path.open("w", encoding="utf-8") as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

print(f"✓ Quality report created: {report_path.name}")

print("\nVALIDATION COMPLETE")
print("=" * 45)
print("Raw files were NOT modified.")

# -----------------------------------------
# 5. PROCESS DISTRICT COMPOSITION DATA
# -----------------------------------------

clean_districts = []

for row in district_rows:
    try:
        value = float(row["القيمة"])
    except (ValueError, TypeError):
        print("⚠ Invalid district value:", row)
        continue

    clean_districts.append({
        "district": row["الاسم"].strip(),
        "district_ar": row["الاسم بالعربية"].strip(),
        "waste_type": row["نوع النفايات"].strip(),
        "percentage": value * 100
    })


# Validate that every district totals 100%
district_totals = defaultdict(float)

for row in clean_districts:
    district_totals[row["district"]] += row["percentage"]

print("\nDISTRICT COMPOSITION CHECK")
print("=" * 45)

invalid_districts = []

for district, total in sorted(district_totals.items()):
    print(f"{district:<30} {total:.2f}%")

    if abs(total - 100) > 0.01:
        invalid_districts.append((district, total))


if invalid_districts:
    print("\n⚠ WARNING: Some districts do not total 100%.")
    for district, total in invalid_districts:
        print(f"  {district}: {total:.2f}%")
else:
    print("\n✓ Every district totals exactly 100%.")


# Export clean district composition
district_output = PROCESSED / "district-composition.json"

with district_output.open("w", encoding="utf-8") as f:
    json.dump(
        clean_districts,
        f,
        ensure_ascii=False,
        indent=2
    )

print(f"✓ District composition created: {district_output.name}")


# -----------------------------------------
# 6. CREATE ONE MAP FEATURE PER DISTRICT
# -----------------------------------------

unique_features = {}

for feature in geojson.get("features", []):

    props = feature.get("properties", {})

    # Find the English district name in the GeoJSON properties
    district_name = (
        props.get("الاسم")
        or props.get("name")
        or props.get("Name")
    )

    if district_name:
        district_name = str(district_name).strip()

        if district_name not in unique_features:
            unique_features[district_name] = feature


clean_geojson = {
    "type": "FeatureCollection",
    "features": list(unique_features.values())
}

clean_geo_output = PROCESSED / "district-map-clean.geojson"

with clean_geo_output.open("w", encoding="utf-8") as f:
    json.dump(
        clean_geojson,
        f,
        ensure_ascii=False,
        separators=(",", ":")
    )

print(
    f"✓ Map reduced from "
    f"{len(geojson.get('features', []))} to "
    f"{len(clean_geojson['features'])} features."
)

print("\nDISTRICT DATA PREPARATION COMPLETE")

# -----------------------------------------
# 7. INSPECT HISTORICAL WASTE DATA
# -----------------------------------------

from collections import Counter

print("\nHISTORICAL DATA CHECK")
print("=" * 45)

# Count records for each year
year_counts = Counter()

# Group records by year + month
month_records = defaultdict(list)

for row in history_rows:

    year = str(row["Year"]).strip()
    month = str(row["Month_EN"]).strip()
    quantity = str(
    row["Quantity of Collected \n(1000 ton) Waste"]
).strip()
    date = str(row["date"]).strip()

    year_counts[year] += 1

    key = (year, month)

    month_records[key].append({
        "quantity": quantity,
        "date": date
    })


print("\nRecords per year:")

for year in sorted(year_counts):
    print(f"{year}: {year_counts[year]} records")


# -----------------------------------------
# FIND DUPLICATED MONTHS
# -----------------------------------------

print("\nDUPLICATED YEAR/MONTH OBSERVATIONS")
print("=" * 45)

duplicate_count = 0

for (year, month), records in sorted(month_records.items()):

    if len(records) > 1:

        duplicate_count += 1

        print(f"\n{month} {year}")

        for record in records:
            print(
                f"  Quantity: {record['quantity']:<15}"
                f"Date: {record['date']}"
            )


print(
    f"\nTotal duplicated year/month combinations: "
    f"{duplicate_count}"
)


# -----------------------------------------
# CHECK 2025 COVERAGE
# -----------------------------------------

print("\n2025 AVAILABLE MONTHS")
print("=" * 45)

months_2025 = []

for row in history_rows:

    if str(row["Year"]).strip() == "2025":
        months_2025.append(
            str(row["Month_EN"]).strip()
        )

print(", ".join(months_2025))


print("\nHISTORICAL INSPECTION COMPLETE")

# -----------------------------------------
# 8. PREPARE SAFE HISTORICAL DATA
# -----------------------------------------

def parse_quantity(value):
    """
    Convert the source quantity field to a number.
    Removes commas/spaces but makes no assumptions
    about conflicting duplicate observations.
    """
    value = str(value).strip().replace(",", "").replace(" ", "")

    try:
        return float(value)
    except ValueError:
        return None


historical_grouped = defaultdict(list)

for row in history_rows:

    year = int(str(row["Year"]).strip())
    month = str(row["Month_EN"]).strip()
    date = str(row["date"]).strip()

    raw_quantity = row[
        "Quantity of Collected \n(1000 ton) Waste"
    ]

    quantity = parse_quantity(raw_quantity)

    historical_grouped[date].append({
        "year": year,
        "month": month,
        "date": date,
        "quantity": quantity,
        "raw_quantity": str(raw_quantity).strip()
    })


safe_history = []
ambiguous_history = []


for date, observations in sorted(historical_grouped.items()):

    # Normal month — exactly one observation
    if len(observations) == 1:

        observation = observations[0]

        if observation["quantity"] is not None:

            safe_history.append({
                "year": observation["year"],
                "month": observation["month"],
                "date": observation["date"],
                "quantity": observation["quantity"],
                "status": "verified-single-observation"
            })

    # Duplicate month — do NOT guess
    else:

        ambiguous_history.append({
            "date": date,
            "year": observations[0]["year"],
            "month": observations[0]["month"],
            "observations": [
                {
                    "quantity": item["quantity"],
                    "raw_quantity": item["raw_quantity"]
                }
                for item in observations
            ],
            "status": "duplicate-requires-review"
        })


# Export safe observations

history_output = PROCESSED / "historical-waste.json"

with history_output.open("w", encoding="utf-8") as f:
    json.dump(
        safe_history,
        f,
        ensure_ascii=False,
        indent=2
    )


# Export ambiguous observations separately

ambiguous_output = PROCESSED / "historical-ambiguities.json"

with ambiguous_output.open("w", encoding="utf-8") as f:
    json.dump(
        ambiguous_history,
        f,
        ensure_ascii=False,
        indent=2
    )


print("\nHISTORICAL DATA PREPARATION")
print("=" * 45)

print(
    f"✓ Safe monthly observations: "
    f"{len(safe_history)}"
)

print(
    f"⚠ Ambiguous duplicated months: "
    f"{len(ambiguous_history)}"
)

print(
    f"✓ Created: {history_output.name}"
)

print(
    f"✓ Created: {ambiguous_output.name}"
)

print("\nNo conflicting duplicate was automatically selected.")
print("Raw historical data remains unchanged.")