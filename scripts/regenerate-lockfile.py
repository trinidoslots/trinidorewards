import subprocess
import os

print("[v0] Starting pnpm-lock.yaml regeneration...")

# Change to project directory
os.chdir("/")

# Remove old lockfile if it exists
lockfile_path = "pnpm-lock.yaml"
if os.path.exists(lockfile_path):
    os.remove(lockfile_path)
    print(f"[v0] Deleted stale {lockfile_path}")

# Run pnpm install to regenerate lockfile
print("[v0] Running pnpm install...")
result = subprocess.run(["pnpm", "install"], capture_output=True, text=True)

if result.returncode == 0:
    print("[v0] ✓ Successfully regenerated pnpm-lock.yaml")
    print("[v0] Lockfile now contains only current dependencies (no shadcn)")
else:
    print(f"[v0] Error running pnpm install:")
    print(result.stderr)
    exit(1)

print("[v0] Done! You can now commit the new pnpm-lock.yaml")
