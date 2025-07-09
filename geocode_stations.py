#!/usr/bin/env python3
"""
RadioMap Station Geocoding Script
==================================

This script fetches all radio stations without coordinates from Radio Browser API
and geocodes them using MapBox API with advanced location pattern matching.

Requirements:
pip install requests tqdm python-dotenv

Usage:
1. Create .env file with: MAPBOX_TOKEN=your_mapbox_token_here
2. Run: python geocode_stations.py

Features:
- Advanced multilingual location pattern matching
- MapBox API integration with rate limiting
- Progress saving and resume capability
- Comprehensive logging
- Duplicate detection and country fallbacks
"""

import os
import re
import json
import time
import logging
import requests
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass
from pathlib import Path
from tqdm import tqdm
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

@dataclass
class GeoResult:
    """Geocoding result container"""
    latitude: float
    longitude: float
    place_name: str
    place_type: str
    confidence: str
    method: str

@dataclass
class Station:
    """Radio station data container"""
    uuid: str
    name: str
    country: str
    state: str = ""
    
class LocationExtractor:
    """Advanced location extraction with multilingual support"""
    
    def __init__(self):
        # Location keywords in multiple languages
        self.city_keywords = [
            'city', 'град', 'город', 'ciudad', 'ville', 'stadt', 'città', 'cidade',
            'メポ', '市', '都市', 'शहर', 'مدينة', 'πόλη', 'miasto', 'város'
        ]
        
        self.village_keywords = [
            'village', 'село', 'деревня', 'поселение', 'поселок', 'aldea', 'pueblo', 
            'villaggio', 'dorf', '村', 'गांव', 'قرية', 'χωριό', 'wieś', 'falu'
        ]
        
        self.region_keywords = [
            'region', 'область', 'район', 'округ', 'edge', 'county', 'province', 
            'estado', 'região', '地域', 'क्षेत्र', 'منطقة', 'περιοχή', 'region', 'megye'
        ]
        
        self.radio_keywords = [
            'radio', 'fm', 'am', 'радио', 'station', 'станция', 'rádio', 'راديو',
            'ραδιόφωνο', 'ラジオ', 'रेडियो', 'radiostacja', 'rádió', 'emisora'
        ]
        
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
        
        # Country name aliases
        self.country_aliases = {
            'usa': 'united states', 'uk': 'united kingdom', 'uae': 'united arab emirates',
            'russia': 'russian federation', 'россия': 'russian federation',
            'украина': 'ukraine', 'беларусь': 'belarus', 'казахстан': 'kazakhstan',
            'deutschland': 'germany', 'españa': 'spain', 'brasil': 'brazil'
        }
        
        # Common radio station prefixes/suffixes to ignore
        self.ignore_patterns = [
            r'\b\d+[\.,]?\d*\s*(fm|am|mhz|khz)\b',  # Frequencies
            r'\b(radio|fm|am|station|станция|радио)\b',  # Radio keywords
            r'\b(the|la|le|el|der|die|das)\b',  # Articles
            r'\b(music|rock|pop|jazz|news|sport)\b',  # Genres
            r'\b(live|online|stream|digital)\b',  # Tech terms
            r'[^\w\s\-\(\)\[\]]+',  # Special characters except basic ones
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
    
    def extract_from_brackets(self, name: str) -> List[str]:
        """Extract locations from parentheses and brackets"""
        locations = []
        
        # Match parentheses and brackets
        bracket_patterns = [
            r'\(([^)]+)\)',  # (location)
            r'\[([^\]]+)\]',  # [location]
            r'\{([^}]+)\}',   # {location}
        ]
        
        for pattern in bracket_patterns:
            matches = re.findall(pattern, name, re.IGNORECASE)
            for match in matches:
                location = match.strip()
                if len(location) > 2 and not any(kw in location.lower() for kw in self.radio_keywords):
                    locations.append(location)
        
        return locations
    
    def extract_with_keywords(self, name: str) -> List[Tuple[str, str]]:
        """Extract locations using keyword patterns"""
        locations = []
        
        # Check city keywords
        for keyword in self.city_keywords:
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
        
        # Check village keywords
        for keyword in self.village_keywords:
            patterns = [
                rf'(\w+)\s+{re.escape(keyword)}',
                rf'{re.escape(keyword)}\s+(\w+)',
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, name, re.IGNORECASE)
                for match in matches:
                    # Filter out blacklisted words  
                    if (len(match) > 2 and
                        match.lower() not in self.non_geographic_words and
                        not any(kw in match.lower() for kw in self.radio_keywords)):
                        locations.append((match, 'village'))
        
        return locations
    
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
        if word_lower in ['the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'с', 'и', 'на', 'в', 'по']:  # Common words
            score -= 10
        if len(word) == 3:  # 3-letter words less likely to be places
            score -= 2
        if word_lower in ['new', 'old', 'big', 'hot', 'top', 'первый', 'новый', 'старый']:  # Adjectives
            score -= 5
            
        return score
    
    def extract_locations(self, station: Station) -> List[Tuple[str, str, int]]:
        """
        Extract all potential locations from station data
        Returns: List of (location, type, priority) tuples
        """
        locations = []
        
        # 1. Extract from brackets (highest priority)
        bracket_locations = self.extract_from_brackets(station.name)
        for loc in bracket_locations:
            locations.append((loc, 'extracted', 10))
        
        # 2. Extract with keywords (high priority)
        keyword_locations = self.extract_with_keywords(station.name)
        for loc, loc_type in keyword_locations:
            locations.append((loc, loc_type, 8))
        
        # 3. State/province (medium priority)
        if station.state and len(station.state) > 2:
            locations.append((station.state, 'region', 6))
        
        # 4. Potential places from name (low priority)
        potential_places = self.extract_potential_places(station.name)
        for place in potential_places:
            locations.append((place, 'potential', 4))
        
        # 5. Country fallback (lowest priority)
        if station.country:
            country = self.country_aliases.get(station.country.lower(), station.country)
            locations.append((country, 'country', 2))
        
        # Remove duplicates and sort by priority
        unique_locations = {}
        for loc, loc_type, priority in locations:
            key = loc.lower()
            if key not in unique_locations or unique_locations[key][2] < priority:
                unique_locations[key] = (loc, loc_type, priority)
        
        return sorted(unique_locations.values(), key=lambda x: x[2], reverse=True)

class MapBoxGeocoder:
    """MapBox API geocoding service"""
    
    def __init__(self, token: str):
        self.token = token
        self.base_url = "https://api.mapbox.com/geocoding/v5/mapbox.places"
        self.cache = {}
        self.api_calls = 0
        self.last_reset = time.time()
        self.max_calls_per_minute = 300  # Conservative limit
        
    def _rate_limit_check(self):
        """Check and enforce rate limits"""
        now = time.time()
        if now - self.last_reset > 60:  # Reset every minute
            self.api_calls = 0
            self.last_reset = now
        
        if self.api_calls >= self.max_calls_per_minute:
            sleep_time = 60 - (now - self.last_reset)
            if sleep_time > 0:
                logging.info(f"Rate limit reached, sleeping for {sleep_time:.1f} seconds")
                time.sleep(sleep_time)
                self.api_calls = 0
                self.last_reset = time.time()
    
    def geocode(self, location: str, country: str = None, place_type: str = 'place') -> Optional[GeoResult]:
        """Geocode a location using MapBox API"""
        # Check cache first
        cache_key = f"{location.lower()}_{country}_{place_type}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        # Rate limiting
        self._rate_limit_check()
        
        # Prepare query
        query = location.strip()
        if country and country.lower() not in query.lower():
            query += f", {country}"
        
        # Determine place types for MapBox
        types = {
            'city': 'place,locality',
            'village': 'locality,neighborhood,place',
            'region': 'region,place',
            'country': 'country',
            'potential': 'place,locality,region'
        }.get(place_type, 'place,locality,region,country')
        
        try:
            url = f"{self.base_url}/{requests.utils.quote(query)}.json"
            params = {
                'access_token': self.token,
                'types': types,
                'limit': 5  # Get more results for better validation
            }
            
            self.api_calls += 1
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('features'):
                # Try to find the best matching result
                best_result = None
                
                for feature in data['features']:
                    lng, lat = feature['center']
                    place_name = feature['place_name']
                    feature_types = feature.get('place_type', [])
                    
                    # Country validation - check if result is in expected country
                    country_match = True
                    if country:
                        # Normalize country names for comparison
                        normalized_country = self._normalize_country_name(country)
                        place_name_lower = place_name.lower()
                        
                        # MapBox format: "City, State, Country" - check the actual country part
                        place_parts = [part.strip() for part in place_name.split(',')]
                        actual_country = place_parts[-1].lower() if place_parts else ""
                        
                        # Get country variations for more flexible matching
                        country_variations = self._get_country_variations(normalized_country)
                        
                        # Check if the actual country matches any variation
                        country_match = any(var in actual_country for var in country_variations)
                        
                        if not country_match:
                            logging.debug(f"Country mismatch: expected '{country}' (variations: {country_variations}), got actual country: '{actual_country}' from '{place_name}'")
                            continue
                    
                    # Determine confidence based on feature type and country match
                    if 'place' in feature_types or 'locality' in feature_types:
                        confidence = 'high' if country_match else 'medium'
                    elif 'region' in feature_types:
                        confidence = 'medium' if country_match else 'low'
                    else:
                        confidence = 'low'
                    
                    result = GeoResult(
                        latitude=lat,
                        longitude=lng,
                        place_name=place_name,
                        place_type=feature_types[0] if feature_types else 'unknown',
                        confidence=confidence,
                        method='mapbox'
                    )
                    
                    # Prefer results with country match and higher confidence
                    if not best_result or (country_match and confidence == 'high'):
                        best_result = result
                        if country_match and confidence == 'high':
                            break  # Found ideal result
                
                if best_result:
                    # Cache result
                    self.cache[cache_key] = best_result
                    return best_result
                
        except Exception as e:
            logging.warning(f"Geocoding failed for '{location}': {e}")
        
        return None
    
    def _normalize_country_name(self, country: str) -> str:
        """Normalize country name for comparison"""
        country_mapping = {
            'the russian federation': 'russia',
            'russian federation': 'russia',
            'united states': 'united states',
            'usa': 'united states',
            'united kingdom': 'united kingdom',
            'uk': 'united kingdom',
            'great britain': 'united kingdom'
        }
        
        normalized = country.lower().strip()
        return country_mapping.get(normalized, normalized)
    
    def _get_country_variations(self, country: str) -> List[str]:
        """Get common variations of country names"""
        variations = {
            'russia': ['russia', 'russian federation', 'russian', 'россия'],
            'united states': ['united states', 'usa', 'america', 'us'],
            'united kingdom': ['united kingdom', 'uk', 'great britain', 'britain', 'england'],
            'germany': ['germany', 'deutschland', 'german'],
            'france': ['france', 'french'],
            'spain': ['spain', 'spanish', 'españa'],
            'italy': ['italy', 'italian', 'italia'],
            'brazil': ['brazil', 'brazilian', 'brasil'],
            'mexico': ['mexico', 'mexican', 'méxico'],
            'canada': ['canada', 'canadian'],
            'australia': ['australia', 'australian'],
            'china': ['china', 'chinese', '中国'],
            'japan': ['japan', 'japanese', '日本'],
            'india': ['india', 'indian'],
            'netherlands': ['netherlands', 'dutch', 'holland'],
            'sweden': ['sweden', 'swedish', 'sverige'],
            'norway': ['norway', 'norwegian', 'norge'],
            'denmark': ['denmark', 'danish', 'danmark'],
            'finland': ['finland', 'finnish', 'suomi'],
            'poland': ['poland', 'polish', 'polska'],
            'romania': ['romania', 'romanian', 'românia'],
            'greece': ['greece', 'greek', 'ελλάδα'],
            'turkey': ['turkey', 'turkish', 'türkiye'],
            'south africa': ['south africa', 'south african'],
            'argentina': ['argentina', 'argentinian'],
            'chile': ['chile', 'chilean'],
            'colombia': ['colombia', 'colombian'],
            'venezuela': ['venezuela', 'venezuelan'],
            'peru': ['peru', 'peruvian', 'perú']
        }
        
        return variations.get(country.lower(), [country.lower()])

class StationGeocoder:
    """Main geocoding orchestrator"""
    
    def __init__(self, mapbox_token: str):
        """Initialize the geocoder with MapBox token"""
        self.mapbox_geocoder = MapBoxGeocoder(mapbox_token)
        self.location_extractor = LocationExtractor()
        self.processed_uuids = set()
        self.results = []
        self.progress_file = 'geocoding_progress.json'
        self.output_file = 'geocoded_stations.json'
        self.reprocess_file = None  # File to reprocess marked stations from
        
        # Load existing progress
        self._load_progress()
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('geocoding.log', encoding='utf-8'),
                logging.StreamHandler()
            ]
        )
    
    def _load_progress(self):
        """Load previously processed stations"""
        if Path(self.progress_file).exists():
            try:
                with open(self.progress_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.processed_uuids = set(data.get('processed_uuids', []))
                    logging.info(f"Loaded {len(self.processed_uuids)} previously processed stations")
            except Exception as e:
                logging.warning(f"Could not load progress: {e}")
        
        if Path(self.output_file).exists():
            try:
                with open(self.output_file, 'r', encoding='utf-8') as f:
                    self.results = json.load(f)
                    logging.info(f"Loaded {len(self.results)} existing results")
            except Exception as e:
                logging.warning(f"Could not load results: {e}")
    
    def _save_progress(self):
        """Save current progress"""
        try:
            # Save processed UUIDs
            with open(self.progress_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'processed_uuids': list(self.processed_uuids),
                    'timestamp': time.time()
                }, f, indent=2)
            
            # Save results
            with open(self.output_file, 'w', encoding='utf-8') as f:
                json.dump(self.results, f, indent=2, ensure_ascii=False)
                
        except Exception as e:
            logging.error(f"Could not save progress: {e}")
    
    def _safe_log_text(self, text: str) -> str:
        """Convert text to ASCII-safe format for logging"""
        return text.encode('ascii', 'replace').decode('ascii')

    def fetch_stations_without_geo(self) -> List[Station]:
        """Fetch stations that need geocoding"""
        try:
            # Check if we should load from existing geocoded file for re-processing
            if self.reprocess_file and os.path.exists(self.reprocess_file):
                print(f"Loading stations from existing geocoded file: {self.reprocess_file}")
                with open(self.reprocess_file, 'r', encoding='utf-8') as f:
                    geocoded_data = json.load(f)
                
                # Filter only stations that need re-geocoding
                stations_to_reprocess = []
                for item in geocoded_data:
                    if item.get('needs_regeocoding', False):
                        station = Station(
                            uuid=item['uuid'],
                            name=item['name'],
                            country=item['country'],
                            state=item.get('state', '')
                        )
                        stations_to_reprocess.append(station)
                
                print(f"Found {len(stations_to_reprocess)} stations marked for re-geocoding")
                return stations_to_reprocess
            
            # Original logic for fresh processing
            print("Fetching stations from Radio Browser API...")
            
            # Base URL for Radio Browser API
            base_url = "http://all.api.radio-browser.info/json/stations"
            
            # Fetch all stations
            all_stations = []
            offset = 0
            limit = 10000  # Fetch in chunks
            
            while True:
                url = f"{base_url}?offset={offset}&limit={limit}&has_geo_info=false"
                
                print(f"Fetching stations {offset} to {offset + limit}...")
                response = requests.get(url, timeout=30)
                
                if response.status_code != 200:
                    print(f"ERROR: API request failed with status {response.status_code}")
                    break
                
                stations_batch = response.json()
                
                if not stations_batch:
                    break  # No more stations
                
                # Filter stations without coordinates
                for station_data in stations_batch:
                    if not station_data.get('geo_lat') and not station_data.get('geo_long'):
                        station = Station(
                            uuid=station_data.get('stationuuid', ''),
                            name=station_data.get('name', ''),
                            country=station_data.get('country', ''),
                            state=station_data.get('state', '')
                        )
                        all_stations.append(station)
                
                offset += limit
                
                # Break if we got fewer results than requested (end of data)
                if len(stations_batch) < limit:
                    break
            
            print(f"Found {len(all_stations)} stations without coordinates")
            return all_stations
            
        except Exception as e:
            print(f"ERROR: Failed to fetch stations: {e}")
            return []
    
    def geocode_station(self, station: Station) -> Optional[Dict]:
        """Geocode a single station"""
        locations = self.location_extractor.extract_locations(station)
        
        if not locations:
            logging.warning(f"No locations extracted for station: {self._safe_log_text(station.name)}")
            return None
        
        # Try each location in priority order
        for location, loc_type, priority in locations:
            result = self.mapbox_geocoder.geocode(location, station.country, loc_type)
            
            if result:
                geocoded_station = {
                    'uuid': station.uuid,
                    'name': station.name,
                    'country': station.country,
                    'state': station.state,
                    'extracted_location': location,
                    'location_type': loc_type,
                    'priority': priority,
                    'latitude': result.latitude,
                    'longitude': result.longitude,
                    'place_name': result.place_name,
                    'mapbox_place_type': result.place_type,
                    'confidence': result.confidence,
                    'method': result.method,
                    'timestamp': time.time()
                    # Note: 'needs_regeocoding' flag is intentionally omitted - this clears the flag
                }
                
                logging.info(f"SUCCESS: Geocoded: {self._safe_log_text(station.name)} -> {self._safe_log_text(result.place_name)}")
                return geocoded_station
        
        logging.warning(f"FAILED: Failed to geocode: {self._safe_log_text(station.name)}")
        return None
    
    def run(self):
        """Main geocoding process"""
        logging.info("Starting station geocoding process...")
        
        # Fetch stations
        stations = self.fetch_stations_without_geo()
        if not stations:
            logging.error("No stations to process")
            return
        
        logging.info(f"Processing {len(stations)} stations...")
        
        # If we're reprocessing, create a lookup for existing results
        existing_results_lookup = {}
        if self.reprocess_file:
            for i, result in enumerate(self.results):
                existing_results_lookup[result['uuid']] = i
            print(f"Created lookup for {len(existing_results_lookup)} existing results")
        
        success_count = 0
        error_count = 0
        
        # Process with progress bar
        with tqdm(total=len(stations), desc="Geocoding stations") as pbar:
            for i, station in enumerate(stations):
                try:
                    result = self.geocode_station(station)
                    
                    if result:
                        # If reprocessing, update existing entry instead of adding new one
                        if self.reprocess_file and station.uuid in existing_results_lookup:
                            existing_index = existing_results_lookup[station.uuid]
                            self.results[existing_index] = result
                            print(f"  Updated existing result for: {station.name}")
                        else:
                            self.results.append(result)
                        success_count += 1
                    else:
                        error_count += 1
                    
                    # Mark as processed
                    self.processed_uuids.add(station.uuid)
                    pbar.update(1)
                    
                    # Save progress every 100 stations
                    if (i + 1) % 100 == 0:
                        self._save_progress()
                        pbar.set_postfix({
                            'Success': success_count,
                            'Errors': error_count,
                            'API Calls': self.mapbox_geocoder.api_calls
                        })
                    
                    # Small delay to be nice to APIs
                    time.sleep(0.1)
                    
                except KeyboardInterrupt:
                    logging.info("Process interrupted by user")
                    break
                except Exception as e:
                    logging.error(f"Error processing station {self._safe_log_text(station.name)}: {e}")
                    error_count += 1
        
        # Final save with deduplication
        self._deduplicate_results()
        self._save_progress()
        
        logging.info(f"""
        SUCCESS: Geocoding completed!
        Results:
           - Total processed: {len(stations)}
           - Successfully geocoded: {success_count}
           - Errors: {error_count}
           - Total API calls: {self.mapbox_geocoder.api_calls}
           - Results saved to: {self.output_file}
        """)
    
    def _deduplicate_results(self):
        """Remove duplicate results based on UUID"""
        if not self.results:
            return
        
        seen_uuids = set()
        deduplicated = []
        duplicates_removed = 0
        
        for result in self.results:
            uuid = result.get('uuid')
            if uuid and uuid not in seen_uuids:
                seen_uuids.add(uuid)
                deduplicated.append(result)
            else:
                duplicates_removed += 1
        
        if duplicates_removed > 0:
            print(f"Removed {duplicates_removed} duplicate results")
            self.results = deduplicated

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Geocode radio stations without coordinates')
    parser.add_argument('--mapbox-token', required=True, help='MapBox API token')
    parser.add_argument('--limit', type=int, help='Limit number of stations to process (for testing)')
    parser.add_argument('--reprocess', type=str, help='Reprocess stations marked for re-geocoding from this file')
    parser.add_argument('--output', type=str, default='geocoded_stations.json', help='Output file name')
    
    args = parser.parse_args()
    
    # Load MapBox token from environment or use provided
    mapbox_token = args.mapbox_token or os.getenv('MAPBOX_TOKEN')
    
    if not mapbox_token:
        print("ERROR: MapBox token is required")
        print("Set MAPBOX_TOKEN environment variable or use --mapbox-token argument")
        return
    
    print("Starting geocoding process...")
    
    # Initialize geocoder
    geocoder = StationGeocoder(mapbox_token)
    geocoder.output_file = args.output
    
    # Set reprocess file if specified
    if args.reprocess:
        geocoder.reprocess_file = args.reprocess
        print(f"Will reprocess stations from: {args.reprocess}")
    
    # Run geocoding
    geocoder.run()

if __name__ == "__main__":
    main() 