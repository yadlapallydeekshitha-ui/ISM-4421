// FAU Owls Weather — powered by the free, key-less Open-Meteo APIs.
// Forecast:  https://open-meteo.com/en/docs
// Geocoding: https://open-meteo.com/en/docs/geocoding-api

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

// Default location: FAU Boca Raton campus.
const FAU_BOCA = {
  name: "FAU · Boca Raton, FL",
  latitude: 26.3705,
  longitude: -80.1024,
};

const STORAGE_KEY = "fau-weather:prefs";

// WMO weather interpretation codes -> [description, day icon, night icon]
const WEATHER_CODES = {
  0: ["Clear sky", "☀️", "🌙"],
  1: ["Mainly clear", "🌤️", "🌙"],
  2: ["Partly cloudy", "⛅", "☁️"],
  3: ["Overcast", "☁️", "☁️"],
  45: ["Fog", "🌫️", "🌫️"],
  48: ["Depositing rime fog", "🌫️", "🌫️"],
  51: ["Light drizzle", "🌦️", "🌧️"],
  53: ["Drizzle", "🌦️", "🌧️"],
  55: ["Dense drizzle", "🌧️", "🌧️"],
  56: ["Light freezing drizzle", "🌧️", "🌧️"],
  57: ["Freezing drizzle", "🌧️", "🌧️"],
  61: ["Light rain", "🌦️", "🌧️"],
  63: ["Rain", "🌧️", "🌧️"],
  65: ["Heavy rain", "🌧️", "🌧️"],
  66: ["Light freezing rain", "🌧️", "🌧️"],
  67: ["Freezing rain", "🌧️", "🌧️"],
  71: ["Light snow", "🌨️", "🌨️"],
  73: ["Snow", "🌨️", "🌨️"],
  75: ["Heavy snow", "❄️", "❄️"],
  77: ["Snow grains", "🌨️", "🌨️"],
  80: ["Light showers", "🌦️", "🌧️"],
  81: ["Showers", "🌧️", "🌧️"],
  82: ["Violent showers", "⛈️", "⛈️"],
  85: ["Light snow showers", "🌨️", "🌨️"],
  86: ["Snow showers", "🌨️", "🌨️"],
  95: ["Thunderstorm", "⛈️", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️", "⛈️"],
  99: ["Severe thunderstorm with hail", "⛈️", "⛈️"],
};

function describe(code, isDay = true) {
  const [text, day, night] = WEATHER_CODES[code] || ["Unknown", "🌡️", "🌡️"];
  return { text, icon: isDay ? day : night };
}

// ---------- state & preferences ----------

const state = {
  unit: "fahrenheit",
  place: { ...FAU_BOCA },
};

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && (saved.unit === "fahrenheit" || saved.unit === "celsius")) state.unit = saved.unit;
    if (saved && saved.place && Number.isFinite(saved.place.latitude) && Number.isFinite(saved.place.longitude)) {
      state.place = saved.place;
    }
  } catch {
    /* storage unavailable — keep defaults */
  }
}

function savePrefs() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ unit: state.unit, place: state.place }));
  } catch {
    /* ignore */
  }
}

// ---------- helpers ----------

const $ = (id) => document.getElementById(id);

function setStatus(message, isError = false) {
  const el = $("status");
  el.textContent = message;
  el.classList.toggle("error", isError);
}

// Open-Meteo returns local wall-clock times (timezone=auto) without an offset,
// e.g. "2026-09-28T14:00". Parse the parts directly so the browser's own
// timezone never shifts them.
function parseLocal(iso) {
  const [date, time = "12:00"] = iso.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

const fmtHour = (iso) => parseLocal(iso).toLocaleTimeString([], { hour: "numeric" });
const fmtTime = (iso) => parseLocal(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtDay = (iso) => parseLocal(iso).toLocaleDateString([], { weekday: "short" });

function tempUnit() {
  return state.unit === "fahrenheit" ? "°F" : "°C";
}

function round(n) {
  return n == null || Number.isNaN(n) ? "–" : Math.round(n);
}

function windDirection(deg) {
  if (deg == null) return "";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function uvLabel(uv) {
  if (uv == null) return "–";
  if (uv < 3) return `${uv.toFixed(1)} Low`;
  if (uv < 6) return `${uv.toFixed(1)} Moderate`;
  if (uv < 8) return `${uv.toFixed(1)} High`;
  if (uv < 11) return `${uv.toFixed(1)} Very high`;
  return `${uv.toFixed(1)} Extreme`;
}

function placeLabel(r) {
  const parts = [r.name];
  if (r.admin1 && r.admin1 !== r.name) parts.push(r.admin1);
  if (r.country_code && r.country_code !== "US") parts.push(r.country || r.country_code);
  return parts.join(", ");
}

// ---------- API calls ----------

async function fetchForecast({ latitude, longitude }) {
  const imperial = state.unit === "fahrenheit";
  const params = new URLSearchParams({
    latitude,
    longitude,
    timezone: "auto",
    forecast_days: "7",
    temperature_unit: state.unit,
    wind_speed_unit: imperial ? "mph" : "kmh",
    precipitation_unit: imperial ? "inch" : "mm",
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "pressure_msl",
    ].join(","),
    hourly: ["temperature_2m", "weather_code", "precipitation_probability", "is_day"].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "sunrise",
      "sunset",
      "uv_index_max",
    ].join(","),
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`Forecast request failed (${res.status})`);
  return res.json();
}

async function searchPlaces(query) {
  const params = new URLSearchParams({ name: query, count: "6", language: "en", format: "json" });
  const res = await fetch(`${GEOCODE_URL}?${params}`);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();
  return data.results || [];
}

// ---------- rendering ----------

function renderCurrent(data) {
  const c = data.current;
  const today = data.daily;
  const { text, icon } = describe(c.weather_code, c.is_day === 1);
  const u = tempUnit();
  const imperial = state.unit === "fahrenheit";

  // Rain chance for the current hour.
  const hourIdx = Math.max(0, data.hourly.time.indexOf(c.time.slice(0, 13) + ":00"));
  const pop = data.hourly.precipitation_probability[hourIdx];

  $("place-name").textContent = state.place.name;
  $("updated").textContent = `Updated ${fmtTime(c.time)} local time`;
  $("current-icon").textContent = icon;
  $("current-temp").textContent = `${round(c.temperature_2m)}${u}`;
  $("current-desc").textContent = text;
  $("current-hilo").textContent = `High ${round(today.temperature_2m_max[0])}${u} · Low ${round(today.temperature_2m_min[0])}${u}`;

  $("stat-feels").textContent = `${round(c.apparent_temperature)}${u}`;
  $("stat-humidity").textContent = `${round(c.relative_humidity_2m)}%`;
  const windUnit = imperial ? "mph" : "km/h";
  $("stat-wind").textContent = `${round(c.wind_speed_10m)} ${windUnit} ${windDirection(c.wind_direction_10m)}`.trim();
  $("stat-wind").title = `Gusts ${round(c.wind_gusts_10m)} ${windUnit}`;
  $("stat-precip").textContent = pop == null ? "–" : `${pop}%`;
  $("stat-uv").textContent = uvLabel(today.uv_index_max[0]);
  $("stat-pressure").textContent = imperial
    ? `${(c.pressure_msl * 0.02953).toFixed(2)} inHg`
    : `${round(c.pressure_msl)} hPa`;
  $("stat-sunrise").textContent = fmtTime(today.sunrise[0]);
  $("stat-sunset").textContent = fmtTime(today.sunset[0]);

  $("current").hidden = false;
}

function renderHourly(data) {
  const h = data.hourly;
  const nowKey = data.current.time.slice(0, 13) + ":00";
  let start = h.time.indexOf(nowKey);
  if (start < 0) start = 0;

  const list = $("hourly");
  list.replaceChildren();
  for (let i = start; i < Math.min(start + 24, h.time.length); i++) {
    const { text, icon } = describe(h.weather_code[i], h.is_day[i] === 1);
    const li = document.createElement("li");
    li.title = text;
    li.innerHTML = `
      <div class="h-time">${i === start ? "Now" : fmtHour(h.time[i])}</div>
      <div class="h-icon" aria-hidden="true">${icon}</div>
      <div class="h-temp">${round(h.temperature_2m[i])}°</div>
      <div class="h-pop">💧 ${h.precipitation_probability[i] ?? 0}%</div>`;
    list.append(li);
  }
  $("hourly-section").hidden = false;
}

function renderDaily(data) {
  const d = data.daily;
  const weekMin = Math.min(...d.temperature_2m_min);
  const weekMax = Math.max(...d.temperature_2m_max);
  const span = Math.max(1, weekMax - weekMin);

  const list = $("daily");
  list.replaceChildren();
  d.time.forEach((day, i) => {
    const { text, icon } = describe(d.weather_code[i]);
    const lo = d.temperature_2m_min[i];
    const hi = d.temperature_2m_max[i];
    const left = ((lo - weekMin) / span) * 100;
    const width = ((hi - lo) / span) * 100;

    const li = document.createElement("li");
    li.innerHTML = `
      <span class="d-day">${i === 0 ? "Today" : fmtDay(day)}</span>
      <span class="d-icon" aria-hidden="true">${icon}</span>
      <span class="d-desc">${text}</span>
      <span class="d-pop">💧 ${d.precipitation_probability_max[i] ?? 0}%</span>
      <span class="d-range">
        <span class="lo">${round(lo)}°</span>
        <span class="d-bar"><span style="left:${left}%;width:${width}%"></span></span>
        <span class="hi">${round(hi)}°</span>
      </span>`;
    list.append(li);
  });
  $("daily-section").hidden = false;
}

// ---------- flow ----------

let requestId = 0;

async function loadWeather() {
  const id = ++requestId;
  setStatus(`Loading weather for ${state.place.name}…`);
  try {
    const data = await fetchForecast(state.place);
    if (id !== requestId) return; // a newer request superseded this one
    renderCurrent(data);
    renderHourly(data);
    renderDaily(data);
    document.title = `${round(data.current.temperature_2m)}${tempUnit()} ${state.place.name} · FAU Owls Weather`;
    setStatus("");
    savePrefs();
  } catch (err) {
    if (id !== requestId) return;
    console.error(err);
    setStatus("Sorry, we couldn't load the weather right now. Please try again in a moment.", true);
  }
}

function selectPlace(place) {
  state.place = place;
  hideResults();
  $("search-input").value = "";
  loadWeather();
}

function hideResults() {
  const ul = $("search-results");
  ul.hidden = true;
  ul.replaceChildren();
}

function showResults(results) {
  const ul = $("search-results");
  ul.replaceChildren();
  if (!results.length) {
    const li = document.createElement("li");
    li.innerHTML = `<button type="button" disabled>No matching places found</button>`;
    ul.append(li);
  }
  for (const r of results) {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    const btn = document.createElement("button");
    btn.type = "button";
    const main = document.createElement("div");
    main.textContent = placeLabel(r);
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = [r.admin2, r.country].filter(Boolean).join(" · ");
    btn.append(main, sub);
    btn.addEventListener("click", () =>
      selectPlace({ name: placeLabel(r), latitude: r.latitude, longitude: r.longitude })
    );
    li.append(btn);
    ul.append(li);
  }
  ul.hidden = false;
}

function setUnit(unit) {
  if (unit === state.unit) return;
  state.unit = unit;
  syncUnitButtons();
  loadWeather();
}

function syncUnitButtons() {
  document.querySelectorAll(".unit-toggle button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.unit === state.unit));
  });
}

function init() {
  loadPrefs();
  syncUnitButtons();

  $("search-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("search-input").value.trim();
    if (q.length < 2) return;
    try {
      showResults(await searchPlaces(q));
    } catch (err) {
      console.error(err);
      setStatus("City search is unavailable right now.", true);
    }
  });

  document.addEventListener("click", (e) => {
    if (!$("search-form").contains(e.target)) hideResults();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideResults();
  });

  $("home-btn").addEventListener("click", () => selectPlace({ ...FAU_BOCA }));

  $("locate-btn").addEventListener("click", () => {
    if (!navigator.geolocation) {
      setStatus("Your browser doesn't support location.", true);
      return;
    }
    setStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        selectPlace({
          name: "My location",
          latitude: Number(pos.coords.latitude.toFixed(4)),
          longitude: Number(pos.coords.longitude.toFixed(4)),
        }),
      () => setStatus("Couldn't get your location. Check your browser's location permission.", true),
      { timeout: 10000 }
    );
  });

  document.querySelectorAll(".unit-toggle button").forEach((b) =>
    b.addEventListener("click", () => setUnit(b.dataset.unit))
  );

  loadWeather();
}

init();
