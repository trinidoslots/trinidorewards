import requests
import csv
from io import StringIO

# Fetch the CSV file
csv_url = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Unbenannte%20Tabelle%20-%20Tabellenblatt1-85M3iTtbHDVj5UfglfVN8Ufe8Mll5f.csv"

print("Fetching CSV file...")
response = requests.get(csv_url)
response.raise_for_status()

# Parse the CSV
csv_content = StringIO(response.text)
csv_reader = csv.reader(csv_content)

# Skip the header row
header = next(csv_reader)
print(f"CSV Headers: {header}")

# Collect all slots
slots = []
for row in csv_reader:
    if len(row) >= 2 and row[0].strip() and row[1].strip():
        game_name = row[0].strip()
        provider = row[1].strip()
        slots.append((game_name, provider))

print(f"\nTotal slots found: {len(slots)}")

# Generate SQL INSERT statements
print("\n-- SQL INSERT statements for slots table")
print("-- Run this after executing script 010_final_slots_table_fix.sql\n")

# Use batch inserts for better performance
batch_size = 50
for i in range(0, len(slots), batch_size):
    batch = slots[i:i+batch_size]
    
    print("INSERT INTO slots (game_name, provider) VALUES")
    
    values = []
    for game_name, provider in batch:
        # Escape single quotes in SQL
        game_name_escaped = game_name.replace("'", "''")
        provider_escaped = provider.replace("'", "''")
        values.append(f"  ('{game_name_escaped}', '{provider_escaped}')")
    
    print(",\n".join(values))
    print("ON CONFLICT (game_name, provider) DO NOTHING;\n")

print(f"\n-- Total: {len(slots)} slots")
