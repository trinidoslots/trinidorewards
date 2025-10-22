import requests
import csv
from io import StringIO

# Fetch the CSV file
csv_url = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Unbenannte%20Tabelle%20-%20Tabellenblatt1-IC0GUy53WWZkJtnT9vvMLeLkrxl7Ff.csv"

try:
    response = requests.get(csv_url)
    response.raise_for_status()
    
    # Parse CSV
    csv_content = StringIO(response.text)
    csv_reader = csv.reader(csv_content)
    
    # Skip header row
    header = next(csv_reader)
    print(f"-- CSV Headers: {header}")
    print(f"-- Column 1 (Game Name): {header[0]}")
    print(f"-- Column 2 (Provider): {header[1]}")
    print()
    
    # Generate SQL INSERT statements
    print("-- Insert slots from CSV")
    print("INSERT INTO slots (game_name, provider) VALUES")
    
    rows = list(csv_reader)
    for i, row in enumerate(rows):
        if len(row) >= 2:
            game_name = row[0].strip().replace("'", "''")  # Escape single quotes
            provider = row[1].strip().replace("'", "''")    # Escape single quotes
            
            if i < len(rows) - 1:
                print(f"  ('{game_name}', '{provider}'),")
            else:
                print(f"  ('{game_name}', '{provider}');")
    
    print(f"\n-- Total slots added: {len(rows)}")
    
except Exception as e:
    print(f"Error fetching or parsing CSV: {e}")
