import requests
import csv
import io

# Fetch the CSV file
url = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Unbenannte%20Tabelle%20-%20Tabellenblatt1-VdbULjzbEl3bYzuHopwyrp15QloO5P.csv"
response = requests.get(url)

if response.status_code == 200:
    # Parse CSV
    csv_content = response.text
    csv_reader = csv.DictReader(io.StringIO(csv_content))
    
    slots = []
    for row in csv_reader:
        # The CSV has columns: "7 Sins" (game name) and "Play'n GO" (provider)
        # Based on the schema provided
        game_name = row.get('7 Sins', '').strip()
        provider = row.get("Play'n GO", '').strip()
        
        if game_name and provider:
            slots.append({
                'game_name': game_name,
                'provider': provider
            })
    
    print(f"[v0] Found {len(slots)} slots in CSV")
    print("[v0] First 10 slots:")
    for slot in slots[:10]:
        print(f"  - {slot['game_name']} ({slot['provider']})")
    
    # Generate SQL INSERT statements
    print("\n[v0] Generating SQL INSERT statements...")
    sql_statements = []
    for slot in slots:
        game_name_escaped = slot['game_name'].replace("'", "''")
        provider_escaped = slot['provider'].replace("'", "''")
        sql_statements.append(f"('{game_name_escaped}', '{provider_escaped}')")
    
    # Print SQL in chunks
    chunk_size = 50
    for i in range(0, len(sql_statements), chunk_size):
        chunk = sql_statements[i:i+chunk_size]
        print(f"\n-- Chunk {i//chunk_size + 1}")
        print(f"INSERT INTO slots (game_name, provider) VALUES")
        print(",\n".join(chunk) + ";")
else:
    print(f"[v0] Error fetching CSV: {response.status_code}")
