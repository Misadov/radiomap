#!/usr/bin/env python3
"""
Validate and fix geocoding results to catch and repair obvious errors
"""

import json
import sys
import os
import time
import argparse
from typing import Dict, List, Set, Optional, Tuple
import re

# Import the improved geocoding logic
class LocationExtractor:
    """Improved location extractor with smart filtering"""
    
    def __init__(self):
        # Words that are clearly NOT geographic locations
        self.non_geographic_words = [
            # Russian
            'пирамида', 'радио', 'плюс', 'европа', 'русское', 'авто', 'хит', 'шансон', 
            'ретро', 'классик', 'музыка', 'новости', 'спорт', 'энергия', 'максимум',
            'люкс', 'элит', 'лайт', 'голд', 'джаз', 'блюз', 'рок', 'поп', 'дача',
            'юмор', 'смех', 'юность', 'дорожное', 'такси', 'бизнес', 'эхо', 'голос',
            'волна', 'звезда', 'комета', 'планета', 'орбита', 'космос', 'мир',
            # English
            'pyramid', 'plus', 'europe', 'auto', 'hit', 'retro', 'classic', 'music',
            'news', 'sport', 'energy', 'maximum', 'luxury', 'elite', 'light', 'gold',
            'jazz', 'blues', 'rock', 'pop', 'humor', 'laugh', 'youth', 'business',
            'echo', 'voice', 'wave', 'star', 'comet', 'planet', 'orbit', 'space',
            'world', 'super', 'mega', 'ultra', 'power', 'force', 'magic', 'diamond',
            'crystal', 'rainbow', 'sunshine', 'moonlight', 'fire', 'ice', 'storm',
            # Common brand words
            'first', 'best', 'top', 'new', 'old', 'big', 'small', 'hot', 'cool',
            'fresh', 'live', 'online', 'digital', 'network', 'central', 'main'
        ]
        
        self.radio_keywords = [
            'radio', 'fm', 'am', 'радио', 'station', 'станция', 'rádio', 'راديو',
            'ραδιόφωνο', 'ラジオ', 'रेडियो', 'radiostacja', 'rádió', 'emisora'
        ]
        
        self.ignore_patterns = [
            r'\b\d+[\.,]?\d*\s*(fm|am|mhz|khz)\b',
            r'\b(radio|fm|am|station|станция|радио)\b',
            r'\b(the|la|le|el|der|die|das)\b',
            r'\b(music|rock|pop|jazz|news|sport)\b',
            r'\b(live|online|stream|digital)\b',
            r'[^\w\s\-\(\)\[\]]+',
        ]
    
    def clean_name(self, name: str) -> str:
        """Clean station name for location extraction"""
        cleaned = name.lower().strip()
        
        # Remove ignore patterns
        for pattern in self.ignore_patterns:
            cleaned = re.sub(pattern, ' ', cleaned, flags=re.IGNORECASE)
        
        # Normalize whitespace
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned
    
    def _score_place_likelihood(self, word: str) -> int:
        """Score how likely a word is to be a place name (higher = more likely)"""
        score = 10  # Base score
        word_lower = word.lower()
        
        # Positive indicators
        if len(word) >= 6:  # Longer words often place names
            score += 3
        if word[0].isupper():  # Capitalized (proper nouns)
            score += 2
        if re.search(r'[аеиоуыэюя].*[аеиоуыэюя]', word_lower):  # Russian vowel pattern
            score += 2
        if re.search(r'[aeiou].*[aeiou]', word_lower):  # English vowel pattern
            score += 2
        if word_lower.endswith(('ово', 'ино', 'ск', 'град', 'бург', 'town', 'burg', 'ville')):  # Place suffixes
            score += 5
        
        # Negative indicators
        if word_lower in ['the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'с', 'и', 'на', 'в', 'по']:
            score -= 10
        if len(word) == 3:  # 3-letter words less likely to be places
            score -= 2
        if word_lower in ['new', 'old', 'big', 'hot', 'top', 'первый', 'новый', 'старый']:
            score -= 5
            
        return score
    
    def extract_potential_places(self, name: str) -> List[str]:
        """Extract potential place names from cleaned text with intelligent filtering"""
        cleaned = self.clean_name(name)
        words = cleaned.split()
        
        potential_places = []
        for word in words:
            # Skip if too short, numeric, or radio-related
            if (len(word) <= 2 or 
                word.isdigit() or 
                any(kw in word for kw in self.radio_keywords) or
                not re.match(r'^[a-zA-Zа-яА-Я\u00C0-\u017F\u0100-\u024F]+$', word)):
                continue
            
            # Skip words that are clearly not geographic
            if word.lower() in self.non_geographic_words:
                continue
                
            # Score the word based on how likely it is to be a place name
            score = self._score_place_likelihood(word)
            if score > 0:  # Only include words with positive scores
                potential_places.append((word, score))
        
        # Sort by score (highest first) and return just the words
        potential_places.sort(key=lambda x: x[1], reverse=True)
        return [word for word, score in potential_places]

    def extract_with_keywords(self, name: str) -> List[Tuple[str, str]]:
        """Extract locations using keyword patterns with blacklist filtering"""
        locations = []
        
        # Check city keywords  
        city_keywords = ['city', 'город', 'ciudad', 'ville', 'stadt', 'città', 'cidade']
        for keyword in city_keywords:
            patterns = [
                rf'(\w+)\s+{re.escape(keyword)}',  # "Moscow city"
                rf'{re.escape(keyword)}\s+(\w+)',  # "city Moscow"
                rf'(\w+[-_]\w+)\s+{re.escape(keyword)}',  # "New-York city"
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, name, re.IGNORECASE)
                for match in matches:
                    # Filter out blacklisted words
                    if (len(match) > 2 and 
                        match.lower() not in self.non_geographic_words and
                        not any(kw in match.lower() for kw in self.radio_keywords)):
                        locations.append((match, 'city'))
        
        return locations

    def extract_locations(self, name: str, country: str = '', state: str = '') -> List[Tuple[str, str, int]]:
        """
        Extract all potential locations from station data  
        Returns: List of (location, type, priority) tuples
        """
        locations = []
        
        # Create a fake station object for compatibility
        class FakeStation:
            def __init__(self, name, country, state):
                self.name = name
                self.country = country  
                self.state = state
        
        station = FakeStation(name, country, state)
        
        # 1. Extract with keywords (high priority) 
        keyword_locations = self.extract_with_keywords(station.name)
        for loc, loc_type in keyword_locations:
            locations.append((loc, loc_type, 8))
        
        # 2. State/province (medium priority)
        if station.state and len(station.state) > 2:
            locations.append((station.state, 'region', 6))
        
        # 3. Potential places from name (low priority)
        potential_places = self.extract_potential_places(station.name)
        for place in potential_places:
            locations.append((place, 'potential', 4))
        
        # Remove duplicates and sort by priority
        unique_locations = {}
        for loc, loc_type, priority in locations:
            key = loc.lower()
            if key not in unique_locations or unique_locations[key][2] < priority:
                unique_locations[key] = (loc, loc_type, priority)
        
        return sorted(unique_locations.values(), key=lambda x: x[2], reverse=True)

def load_geocoded_results(filename: str) -> List[Dict]:
    """Load geocoded stations from JSON file"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"ERROR: Failed to load {filename}: {e}")
        return []

def save_geocoded_results(filename: str, stations: List[Dict]) -> bool:
    """Save geocoded stations to JSON file"""
    try:
        # Create backup first
        backup_name = f"{filename}.backup.{int(time.time())}"
        if os.path.exists(filename):
            import shutil
            shutil.copy2(filename, backup_name)
            print(f"Created backup: {backup_name}")
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(stations, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"ERROR: Failed to save {filename}: {e}")
        return False

def validate_station_result(station: Dict) -> List[str]:
    """Validate a single station's geocoding result"""
    issues = []
    
    name = station.get('name', '').lower()
    place_name = station.get('place_name', '')
    extracted_location = station.get('extracted_location', '').lower()
    country = station.get('country', '').lower()
    confidence = station.get('confidence', '')
    
    # Check for obvious mismatches
    if 'russian federation' in country or 'russia' in country:
        # Russian station shouldn't be in other countries
        if any(wrong_country in place_name.lower() for wrong_country in 
               ['venezuela', 'colombia', 'brazil', 'mexico', 'argentina', 'peru']):
            issues.append(f"Russian station geocoded to South America: {place_name}")
    
    # Check for obviously bad extracted locations
    bad_extractions = [
        'пирамида', 'pyramid', 'плюс', 'plus', 'европа', 'europe', 
        'радио', 'radio', 'хит', 'hit', 'музыка', 'music', 'спорт', 'sport',
        'энергия', 'energy', 'максимум', 'maximum', 'классик', 'classic',
        'джаз', 'jazz', 'блюз', 'blues', 'рок', 'rock', 'поп', 'pop'
    ]
    
    if extracted_location in bad_extractions:
        issues.append(f"Bad extraction: '{extracted_location}' from '{name}'")
    
    # Check for confidence issues
    if confidence == 'low' and 'potential' in station.get('location_type', ''):
        issues.append(f"Low confidence on potential match: {extracted_location}")
    
    return issues

def is_problematic_station(station: Dict) -> bool:
    """Check if a station has problematic geocoding"""
    issues = validate_station_result(station)
    return len(issues) > 0

def fix_problematic_station(station: Dict, extractor: LocationExtractor, mapbox_token: str) -> Optional[Dict]:
    """Re-geocode a problematic station using improved logic"""
    try:
        # Extract better locations using improved logic
        location_tuples = extractor.extract_locations(
            station['name'], 
            station.get('country', ''),
            station.get('state', '')
        )
        
        if not location_tuples:
            print(f"  No valid locations found for: {station['name']}")
            return None
        
        # Get the highest priority location
        best_location, best_type, best_priority = location_tuples[0]
        print(f"  Re-extracted: '{best_location}' (type: {best_type}, priority: {best_priority}) from '{station['name']}'")
        
        # Clear the inconsistent old data and mark for re-geocoding
        fixed_station = station.copy()
        fixed_station['extracted_location'] = best_location
        fixed_station['location_type'] = best_type
        fixed_station['priority'] = best_priority
        fixed_station['timestamp'] = time.time()
        
        # Clear old bad geocoding data to prevent inconsistency
        fixed_station['latitude'] = None
        fixed_station['longitude'] = None  
        fixed_station['place_name'] = f"NEEDS_REGEOCODING: {best_location}"
        fixed_station['mapbox_place_type'] = None
        fixed_station['confidence'] = None
        fixed_station['method'] = 'pending_regeocoding'
        
        # Mark as needing re-geocoding
        fixed_station['needs_regeocoding'] = True
        
        return fixed_station
        
    except Exception as e:
        print(f"  ERROR fixing station {station['name']}: {e}")
        return None

def find_problematic_results(stations: List[Dict], max_issues: int = 20) -> List[Dict]:
    """Find and report the most problematic geocoding results"""
    print("=== GEOCODING VALIDATION REPORT ===")
    print()
    
    total_stations = len(stations)
    problematic_stations = []
    
    for station in stations:
        if is_problematic_station(station):
            problematic_stations.append(station)
    
    issue_count = len(problematic_stations)
    
    # Show first few issues
    for i, station in enumerate(problematic_stations[:max_issues]):
        issues = validate_station_result(station)
        print(f"PROBLEMATIC: {station.get('name', 'Unknown')}")
        print(f"  UUID: {station.get('uuid', 'Unknown')}")
        print(f"  Country: {station.get('country', 'Unknown')}")
        print(f"  Extracted: {station.get('extracted_location', 'Unknown')}")
        print(f"  Result: {station.get('place_name', 'Unknown')}")
        print(f"  Issues:")
        for issue in issues:
            print(f"    - {issue}")
        print()
    
    print(f"=== SUMMARY ===")
    print(f"Total stations: {total_stations}")
    print(f"Problematic results: {issue_count}")
    print(f"Error rate: {issue_count/total_stations*100:.1f}%")
    
    if issue_count > max_issues:
        print(f"(Showing first {max_issues} issues only)")
    
    return problematic_stations

def fix_geocoding_file(filename: str, mapbox_token: str = None) -> None:
    """Fix problematic geocoding results in the JSON file"""
    print(f"Loading stations from {filename}...")
    stations = load_geocoded_results(filename)
    
    if not stations:
        print("No stations loaded. Exiting.")
        return
    
    print(f"Loaded {len(stations)} stations")
    
    # Find problematic stations
    print("\nIdentifying problematic stations...")
    problematic = []
    for station in stations:
        if is_problematic_station(station):
            problematic.append(station)
    
    if not problematic:
        print("No problematic stations found!")
        return
    
    print(f"Found {len(problematic)} problematic stations")
    print("\nExamples of problems:")
    for station in problematic[:3]:
        issues = validate_station_result(station)
        print(f"  {station['name']} -> {station.get('place_name', 'Unknown')}")
        for issue in issues:
            print(f"    - {issue}")
    
    # Ask for confirmation
    response = input(f"\nFix {len(problematic)} problematic stations? (y/N): ")
    if response.lower() != 'y':
        print("Cancelled.")
        return
    
    # Fix the problematic stations
    extractor = LocationExtractor()
    fixed_count = 0
    
    print(f"\nFixing {len(problematic)} stations...")
    
    # Create a lookup for quick station updates
    station_lookup = {station['uuid']: i for i, station in enumerate(stations)}
    
    for i, problem_station in enumerate(problematic):
        print(f"[{i+1}/{len(problematic)}] Fixing: {problem_station['name']}")
        
        fixed_station = fix_problematic_station(problem_station, extractor, mapbox_token)
        if fixed_station:
            # Update the station in the main list
            station_index = station_lookup[problem_station['uuid']]
            stations[station_index] = fixed_station
            fixed_count += 1
        
        # Progress update every 10 stations
        if (i + 1) % 10 == 0 or i == len(problematic) - 1:
            print(f"  Progress: {i+1}/{len(problematic)} ({(i+1)/len(problematic)*100:.1f}%)")
    
    print(f"\nFixed {fixed_count} stations")
    
    # Save the updated file
    if save_geocoded_results(filename, stations):
        print(f"Updated file saved: {filename}")
        print(f"Fixed stations are marked with 'needs_regeocoding': true")
        print("You can now run the geocoding script to only process these marked stations.")
    else:
        print("Failed to save updated file!")

def check_specific_station(stations: List[Dict], search_name: str) -> None:
    """Check a specific station by name"""
    search_lower = search_name.lower()
    found = False
    
    for station in stations:
        if search_lower in station.get('name', '').lower():
            found = True
            print(f"=== FOUND: {station.get('name')} ===")
            print(f"UUID: {station.get('uuid')}")
            print(f"Country: {station.get('country')}")
            print(f"Extracted: {station.get('extracted_location')}")
            print(f"Location Type: {station.get('location_type')}")
            print(f"Priority: {station.get('priority')}")
            print(f"Coordinates: {station.get('latitude')}, {station.get('longitude')}")
            print(f"Place Name: {station.get('place_name')}")
            print(f"Confidence: {station.get('confidence')}")
            print(f"Method: {station.get('method')}")
            
            issues = validate_station_result(station)
            if issues:
                print("ISSUES:")
                for issue in issues:
                    print(f"  - {issue}")
            else:
                print("No obvious issues detected.")
            print()
    
    if not found:
        print(f"No stations found matching '{search_name}'")

def main():
    parser = argparse.ArgumentParser(description='Validate and fix geocoding results')
    parser.add_argument('json_file', help='Path to geocoded_stations.json file')
    parser.add_argument('--fix', action='store_true', help='Fix problematic results in-place')
    parser.add_argument('--search', type=str, help='Search for specific station by name')
    parser.add_argument('--mapbox-token', type=str, help='MapBox API token for re-geocoding')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.json_file):
        print(f"ERROR: File not found: {args.json_file}")
        return
    
    stations = load_geocoded_results(args.json_file)
    
    if not stations:
        print("No stations loaded. Exiting.")
        return
    
    if args.search:
        # Search for specific station
        check_specific_station(stations, args.search)
    elif args.fix:
        # Fix problematic results
        fix_geocoding_file(args.json_file, args.mapbox_token)
    else:
        # Just validate and report
        find_problematic_results(stations)

if __name__ == "__main__":
    main() 