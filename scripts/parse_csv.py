import requests
import csv
from io import StringIO

# Fetch the CSV file
url = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Unbenannte%20Tabelle%20-%20Tabellenblatt1-IC0GUy53WWZkJtnT9vvMLeLkrxl7Ff.csv"
response = requests.get(url)
response.encoding = 'utf-8'

# Parse CSV
csv_data = StringIO(response.text)
reader = csv.DictReader(csv_data)

# Get the column names (first row becomes keys)
rows = list(reader)

# The CSV has columns where the first column name is a slot name and second is provider
# We need to extract the actual column names
if rows:
    first_row_keys = list(rows[0].keys())
    print(f"Column names: {first_row_keys}")
    print(f"\nFirst few rows:")
    for i, row in enumerate(rows[:5]):
        print(f"Row {i+1}: {row}")
    
    print(f"\nTotal rows: {len(rows)}")
    
    # Generate SQL INSERT statements
    print("\n\n-- SQL INSERT statements:")
    print("DELETE FROM slots;")
    print("\nINSERT INTO slots (game_name, provider) VALUES")
    
    sql_values = []
    for row in rows:
        # The column names are the slot name and provider
        # We need to get the values from the first two columns
        values = list(row.values())
        if len(values) >= 2 and values[0] and values[1]:
            slot_name = values[0].replace("'", "''")
            provider = values[1].replace("'", "''")
            sql_values.append(f"('{slot_name}', '{provider}')")
    
    print(",\n".join(sql_values) + ";")
