n#!/usr/bin/env python3
"""
Clean up duplicates and inconsistent states in geocoded results
"""

import json
import sys
import time
from typing import Dict, List

def load_stations(filename: str) -> List[Dict]:
    """Load stations from JSON file"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"ERROR: Failed to load {filename}: {e}")
        return []

def save_stations(filename: str, stations: List[Dict]) -> bool:
    """Save stations to JSON file with backup"""
    try:
        # Create backup
        backup_name = f"{filename}.backup.{int(time.time())}"
        import shutil
        shutil.copy2(filename, backup_name)
        print(f"Created backup: {backup_name}")
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(stations, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"ERROR: Failed to save {filename}: {e}")
        return False

def remove_duplicates(stations: List[Dict]) -> List[Dict]:
    """Remove duplicate stations based on UUID, keeping the most recent"""
    print("Removing duplicates...")
    
    uuid_to_station = {}
    duplicates_found = 0
    
    for station in stations:
        uuid = station.get('uuid')
        if not uuid:
            continue
            
        if uuid in uuid_to_station:
            duplicates_found += 1
            existing = uuid_to_station[uuid]
            current_timestamp = station.get('timestamp', 0)
            existing_timestamp = existing.get('timestamp', 0)
            
            # Keep the one with the more recent timestamp
            if current_timestamp > existing_timestamp:
                uuid_to_station[uuid] = station
                print(f"  Kept newer version of: {station.get('name', 'Unknown')}")
            else:
                print(f"  Kept older version of: {existing.get('name', 'Unknown')}")
        else:
            uuid_to_station[uuid] = station
    
    if duplicates_found > 0:
        print(f"Found and resolved {duplicates_found} duplicates")
    else:
        print("No duplicates found")
    
    return list(uuid_to_station.values())

def fix_inconsistent_states(stations: List[Dict]) -> List[Dict]:
    """Fix stations with inconsistent coordinates/place names"""
    print("Fixing inconsistent states...")
    
    fixed_count = 0
    
    for station in stations:
        needs_regeocoding = station.get('needs_regeocoding', False)
        extracted_location = station.get('extracted_location', '')
        place_name = station.get('place_name', '')
        
        # If marked for regeocoding but still has old coordinates, clear them
        if needs_regeocoding and place_name and not place_name.startswith('NEEDS_REGEOCODING:'):
            print(f"  Fixing inconsistent state: {station.get('name', 'Unknown')}")
            station['latitude'] = None
            station['longitude'] = None  
            station['place_name'] = f"NEEDS_REGEOCODING: {extracted_location}"
            station['mapbox_place_type'] = None
            station['confidence'] = None
            station['method'] = 'pending_regeocoding'
            fixed_count += 1
    
    if fixed_count > 0:
        print(f"Fixed {fixed_count} inconsistent states")
    else:
        print("No inconsistent states found")
    
    return stations

def get_statistics(stations: List[Dict]) -> None:
    """Print statistics about the stations"""
    total = len(stations)
    needs_regeocoding = sum(1 for s in stations if s.get('needs_regeocoding', False))
    successful = sum(1 for s in stations if s.get('latitude') is not None and s.get('longitude') is not None)
    
    print(f"\n=== STATISTICS ===")
    print(f"Total stations: {total}")
    print(f"Successfully geocoded: {successful}")
    print(f"Need re-geocoding: {needs_regeocoding}")
    print(f"Success rate: {successful/total*100:.1f}%")

def main():
    if len(sys.argv) != 2:
        print("Usage: python cleanup_duplicates.py <geocoded_stations.json>")
        print("\nThis will:")
        print("- Remove duplicate stations (keeping most recent)")
        print("- Fix inconsistent states (clear old coordinates for stations marked for re-geocoding)")
        print("- Create a backup before making changes")
        return
    
    filename = sys.argv[1]
    
    print(f"Loading stations from {filename}...")
    stations = load_stations(filename)
    
    if not stations:
        print("No stations loaded. Exiting.")
        return
    
    print(f"Loaded {len(stations)} stations")
    
    # Get initial statistics
    get_statistics(stations)
    
    # Remove duplicates
    stations = remove_duplicates(stations)
    
    # Fix inconsistent states
    stations = fix_inconsistent_states(stations)
    
    # Get final statistics
    get_statistics(stations)
    
    # Save cleaned file
    if save_stations(filename, stations):
        print(f"\nCleaned file saved: {filename}")
        print("You can now run the geocoding script to process stations marked for re-geocoding")
    else:
        print("Failed to save cleaned file!")

if __name__ == "__main__":
    main() 