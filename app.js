const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const locationSelect = document.getElementById('locationSelect');
const loadWeatherButton = document.getElementById('loadWeatherButton');
const statusEl = document.getElementById('status');

const summarySection = document.getElementById('summary');
const chartsSection = document.getElementById('charts');
const locationNameEl = document.getElementById('locationName');
const currentTempEl = document.getElementById('currentTemp');
const dailyRangeEl = document.getElementById('dailyRange');
const apparentTempEl = document.getElementById('apparentTemp');
const precipProbabilityEl = document.getElementById('precipProbability');

let foundLocations = [];
let hourlyTempChart;
let dailyTempChart;
let rainChart;

function setStatus(message) {
  statusEl.textContent = message;
}

function formatLocation(location) {
  const country = location.country || 'Neznámá země';
  const admin = location.admin1 ? `, ${location.admin1}` : '';
  return `${location.name}${admin}, ${country}`;
}

async function searchLocations() {
  const query = searchInput.value.trim();
  if (query.length < 2) {
    setStatus('Zadej alespoň 2 znaky pro hledání.');
    return;
  }

  setStatus('Vyhledávám lokality…');
  locationSelect.disabled = true;
  loadWeatherButton.disabled = true;

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=20&language=cs&format=json`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Nelze načíst geolokace.');
    }

    const data = await response.json();
    foundLocations = data.results || [];

    locationSelect.innerHTML = '';

    if (foundLocations.length === 0) {
      locationSelect.innerHTML = '<option>Nebyla nalezena žádná lokalita</option>';
      setStatus('Zkus jiný název místa.');
      return;
    }

    foundLocations.forEach((location, index) => {
      const option = document.createElement('option');
      option.value = index.toString();
      option.textContent = formatLocation(location);
      locationSelect.appendChild(option);
    });

    locationSelect.disabled = false;
    loadWeatherButton.disabled = false;
    setStatus(`Nalezeno lokalit: ${foundLocations.length}`);
  } catch (error) {
    setStatus(`Chyba: ${error.message}`);
  }
}

async function loadWeather() {
  const selectedIndex = Number(locationSelect.value);
  const selectedLocation = foundLocations[selectedIndex];

  if (!selectedLocation) {
    setStatus('Nejprve vyber lokalitu ze seznamu.');
    return;
  }

  setStatus('Načítám počasí a data do grafů…');

  try {
    const params = new URLSearchParams({
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      current: 'temperature_2m,apparent_temperature',
      hourly: 'temperature_2m,precipitation',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      forecast_days: '7',
      timezone: 'auto'
    });

    const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);

    if (!weatherResponse.ok) {
      throw new Error('Nepodařilo se načíst data o počasí.');
    }

    const weather = await weatherResponse.json();
    renderSummary(selectedLocation, weather);
    renderCharts(weather);

    summarySection.classList.remove('hidden');
    chartsSection.classList.remove('hidden');
    setStatus('Hotovo. Data jsou aktuální pro vybranou lokaci.');
  } catch (error) {
    setStatus(`Chyba: ${error.message}`);
  }
}

function renderSummary(location, weather) {
  const todayMax = weather.daily.temperature_2m_max[0];
  const todayMin = weather.daily.temperature_2m_min[0];
  const currentTemp = weather.current.temperature_2m;
  const apparentTemp = weather.current.apparent_temperature;
  const todayPrecip = weather.daily.precipitation_probability_max[0];

  locationNameEl.textContent = formatLocation(location);
  currentTempEl.textContent = `${currentTemp.toFixed(1)} °C`;
  dailyRangeEl.textContent = `${todayMax.toFixed(1)} °C / ${todayMin.toFixed(1)} °C`;
  apparentTempEl.textContent = `${apparentTemp.toFixed(1)} °C`;
  precipProbabilityEl.textContent = `${todayPrecip}%`;
}

function destroyCharts() {
  [hourlyTempChart, dailyTempChart, rainChart].forEach((chart) => {
    if (chart) {
      chart.destroy();
    }
  });
}

function renderCharts(weather) {
  destroyCharts();

  const hourlyTimes = weather.hourly.time.slice(0, 24).map((iso) => {
    const date = new Date(iso);
    return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  });

  const hourlyTemps = weather.hourly.temperature_2m.slice(0, 24);
  const hourlyRain = weather.hourly.precipitation.slice(0, 24);

  const dayLabels = weather.daily.time.map((d) => {
    const date = new Date(d);
    return date.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' });
  });

  hourlyTempChart = new Chart(document.getElementById('hourlyTempChart'), {
    type: 'line',
    data: {
      labels: hourlyTimes,
      datasets: [{
        label: 'Teplota (°C)',
        data: hourlyTemps,
        borderColor: '#ff6f61',
        backgroundColor: 'rgba(255,111,97,0.2)',
        tension: 0.3,
        fill: true
      }]
    }
  });

  dailyTempChart = new Chart(document.getElementById('dailyTempChart'), {
    type: 'bar',
    data: {
      labels: dayLabels,
      datasets: [
        {
          label: 'Max (°C)',
          data: weather.daily.temperature_2m_max,
          backgroundColor: '#ff9f40'
        },
        {
          label: 'Min (°C)',
          data: weather.daily.temperature_2m_min,
          backgroundColor: '#36a2eb'
        }
      ]
    }
  });

  rainChart = new Chart(document.getElementById('rainChart'), {
    type: 'line',
    data: {
      labels: hourlyTimes,
      datasets: [{
        label: 'Srážky (mm)',
        data: hourlyRain,
        borderColor: '#4bc0c0',
        backgroundColor: 'rgba(75,192,192,0.25)',
        tension: 0.35,
        fill: true
      }]
    }
  });
}

searchButton.addEventListener('click', searchLocations);
loadWeatherButton.addEventListener('click', loadWeather);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    searchLocations();
  }
});
