

# *This project was created using [Cursor AI](https://cursor.com/) for personal use. May contain bugs!*

# RadioMap - Discover World Radio Stations

#[Online version] (https://radiomap.vercel.app)

A modern web application for discovering and listening to radio stations from around the world. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 🗺️ **Interactive Map**: Browse radio stations on a world map with clickable markers
- 📻 **Station List**: Browse stations in a searchable list with filtering options
- 🎵 **Audio Player**: Built-in audio player with play/pause, volume control, and station info
- 🔍 **Advanced Search**: Filter by country, genre, language, and popularity
- 🌍 **Worldwide Coverage**: Access to thousands of radio stations globally

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Maps**: Leaflet, React Leaflet
- **Icons**: Lucide React
- **API**: Radio Browser API
- **Audio**: HTML5 Audio API

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd radiomap
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm run start
```

## Usage

### Map View
- Toggle to "Map" mode to see radio stations plotted on an interactive world map
- Click on blue markers to see station details
- Click the play button to start listening to a station
- Zoom and pan to explore different regions

### List View
- Toggle to "List" mode to browse stations in a grid layout
- Use the search bar to find stations by name, country, or genre
- Click "Filters" to access advanced filtering options:
  - **Country**: Filter by specific countries
  - **Genre**: Filter by music genres or content types
  - **Language**: Filter by broadcast language
  - **Min Votes**: Filter by popularity (user votes)

### Audio Player
- Appears at the bottom when a station is playing
- Controls: Play/Pause, Volume, Station Info, Close
- Shows current station details including country, genre, and bitrate
- Click the info button for extended station details and website links

## API

This application uses the [Radio Browser API](https://www.radio-browser.info/) to fetch radio station data. The API provides:

- Worldwide radio station database
- Station metadata (country, genre, language, etc.)
- Real-time station status
- Geographic coordinates for mapping

**Geocoding features require [MapBox](https://docs.mapbox.com/api/guides/) API key**

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Radio Browser](https://www.radio-browser.info/) for providing the radio station API
- [MapBox](https://mapbox.com/) for geocoding stations without geo info 
- [OpenStreetMap](https://www.openstreetmap.org/) for map tiles
- [Leaflet](https://leafletjs.com/) for map functionality
- [Lucide](https://lucide.dev/) for beautiful icons 
