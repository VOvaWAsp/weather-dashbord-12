// Обираємо React, оскільки він дозволяє створювати компоненти
// та автоматично оновлювати інтерфейс при зміні стану.

console.log("app.js підключено");

const apiKey = "a66281db80595ed12520a9c8df8e5b0a";

const apiUrl = "https://api.openweathermap.org/data/2.5/weather?q=";
const forecastUrl = "https://api.openweathermap.org/data/2.5/forecast?q=";

const weatherSearchForm = document.querySelector("#weather-search-form");
const cityInput = document.querySelector("#weather-input");
const error = document.querySelector(".error");

const containerSingle = document.querySelector("#current-weather");
const weatherImg = document.querySelector(".weather-img");

const saveCityButton = document.querySelector("#save-city-button");
const savedCitiesList = document.querySelector("#saved-cities-list");
const storageError = document.querySelector("#storage-error");

const weatherForm = document.querySelector("#weather-form");
const dayInput = document.querySelector("#day");
const tempInput = document.querySelector("#tempC");
const descriptionInput = document.querySelector("#description");
const recordsList = document.querySelector("#records-list");
const hottestDayButton = document.querySelector("#hottest-day-button");
const hottestDayResult = document.querySelector("#hottest-day-result");

const weatherRecords = [];

let savedCities = [];

let lastWeatherData = null;

// Збереження масиву міст у LocalStorage
function saveToLocalStorage(items) {
    localStorage.setItem("savedCities", JSON.stringify(items));
}

// Завантаження міст із LocalStorage
function loadFromLocalStorage() {
    try {
        const raw = localStorage.getItem("savedCities");

        return raw ? JSON.parse(raw) : [];

    } catch (error) {
        console.error("Помилка читання LocalStorage:", error);

        return [];
    }
}

savedCities = loadFromLocalStorage();

const weatherTranslations = {
    "clear sky": "Ясно",
    "few clouds": "Малохмарно",
    "scattered clouds": "Мінлива хмарність",
    "broken clouds": "Хмарно",
    "overcast clouds": "Похмуро",
    "shower rain": "Злива",
    "rain": "Дощ",
    "light rain": "Невеликий дощ",
    "moderate rain": "Помірний дощ",
    "heavy intensity rain": "Сильний дощ",
    "thunderstorm": "Гроза",
    "snow": "Сніг",
    "mist": "Туман",
    "fog": "Туман"
};


async function getWeather(city) {
    try {
        const response = await fetch(
            `${apiUrl}${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Місто не знайдено");
        }

        lastWeatherData = data;

        const temperature = Math.round(data.main.temp);

        document.querySelector(".city").textContent = data.name;

        document.querySelector(".temp").textContent =
            `${temperature}°C`;

        const description = data.weather[0].description;

        document.querySelector(".description").textContent =
            weatherTranslations[description] || description;

        weatherImg.src =
            `https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`;

        weatherImg.alt = description;

        containerSingle.classList.remove("cold", "warm", "mild");

        if (temperature <= 10) {
            containerSingle.classList.add("cold");
        } else if (temperature >= 25) {
            containerSingle.classList.add("warm");
        } else {
            containerSingle.classList.add("mild");
        }

        error.style.display = "none";

        containerSingle.style.display = "block";

        return data;

    } catch (err) {
        console.error("Помилка отримання поточної погоди:", err);

        lastWeatherData = null;

        error.textContent =
            "Не вдалося знайти місто. Перевірте назву та спробуйте ще раз.";

        error.style.display = "block";

        containerSingle.style.display = "none";

        return null;
    }
}

// Відкриття бази даних IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {

        const request = indexedDB.open("WeatherDashboardDB", 1);

                // Створення сховища під час першого відкриття бази
        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains("cities")) {
                db.createObjectStore("cities", {
                    keyPath: "id"
                });
            }
        };

                // Успішне відкриття бази
        request.onsuccess = () => {
            const db = request.result;

            db.onversionchange = () => db.close();

            resolve(db);
        };

                // Обробка помилки відкриття бази
        request.onerror = () => {
            reject(request.error);
        };

                // База заблокована іншим відкритим з'єднанням
        request.onblocked = () => {
            console.warn("Відкриття бази IndexedDB заблоковано.");
        };
    });
}

// Додавання нового міста до IndexedDB
async function addItem(item) {
    const db = await openDB();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction("cities", "readwrite");

        transaction.objectStore("cities").put(item);

        transaction.oncomplete = () => resolve();

        transaction.onerror = () => reject(transaction.error);

        transaction.onabort = () => reject(transaction.error);
    });
}

// Оновлення інформації про місто
async function updateItem(item) {
    const db = await openDB();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction("cities", "readwrite");

        transaction.objectStore("cities").put(item);

        transaction.oncomplete = () => resolve();

        transaction.onerror = () => reject(transaction.error);

        transaction.onabort = () => reject(transaction.error);
    });
}

// Отримання всіх збережених міст
async function getAllItems() {
    const db = await openDB();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction("cities", "readonly");

        const request = transaction.objectStore("cities").getAll();

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => reject(request.error);

        transaction.onabort = () => reject(transaction.error);
    });
}

// Видалення міста за його ідентифікатором
async function deleteItem(id) {
    const db = await openDB();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction("cities", "readwrite");

        transaction.objectStore("cities").delete(id);

        transaction.oncomplete = () => resolve();

        transaction.onerror = () => reject(transaction.error);

        transaction.onabort = () => reject(transaction.error);
    });
}

// Одноразове перенесення міст із LocalStorage до IndexedDB
async function migrateLocalStorageToIndexedDB() {

    const migrated = localStorage.getItem("citiesMigrated");

        // Перевіряємо, чи міграція вже виконувалася
    if (migrated === "true") {
        return;
    }

        // Отримуємо дані з обох сховищ
    const indexedCities = await getAllItems();

    const localCities = loadFromLocalStorage();

        // Переносимо дані, якщо IndexedDB порожня
    if (indexedCities.length === 0 && localCities.length > 0) {

        for (const city of localCities) {
            await addItem(city);
        }

        console.log("Міста перенесено до IndexedDB");
    }

        // Позначаємо, що міграція вже виконана
    localStorage.setItem("citiesMigrated", "true");
}


// Створення об'єкта міста з даних OpenWeather API
function createCityObject(data, existingCity = null) {
    return {
        id: existingCity ? existingCity.id : crypto.randomUUID(),

        name: data.name,

        lat: data.coord.lat,

        lon: data.coord.lon,

        temperature: Math.round(data.main.temp),

        weatherCode: data.weather[0].id,

        time: new Date(data.dt * 1000).toISOString()
    };
}

// Додавання або оновлення міста в IndexedDB
async function saveCity() {

    if (!lastWeatherData) {
        error.textContent = "Спочатку знайдіть місто.";
        error.style.display = "block";
        return;
    }

    try {
        // Отримуємо актуальний список міст
        const cities = await getAllItems();
        // Перевіряємо, чи місто вже існує
        const existingCity = cities.find(
            city => city.name.toLowerCase() ===
                lastWeatherData.name.toLowerCase()
        );

        const city = createCityObject(lastWeatherData, existingCity);

        if (existingCity) {
            // Оновлюємо наявне місто
            await updateItem(city);

        } else {
            // Додаємо нове місто
            await addItem(city);
        }
        // Оновлюємо список після операції
        await refreshSavedCities();

        console.log("Місто збережено:", city);

    } catch (error) {

        console.error("Помилка збереження міста:", error);

        storageError.textContent =
            "Не вдалося зберегти місто.";

        storageError.style.display = "block";
    }
}

// Відображення збережених міст
function renderSavedCities(cities) {

    savedCitiesList.replaceChildren();

    if (cities.length === 0) {

        const message = document.createElement("p");

        message.textContent = "Поки що немає збережених міст.";

        savedCitiesList.append(message);

        return;
    }

    cities.forEach(city => {

        const card = document.createElement("article");

        card.classList.add("forecast-card");

        const name = document.createElement("h3");

        name.textContent = city.name;

        const temperature = document.createElement("p");

        temperature.textContent = `${city.temperature}°C`;

        const coordinates = document.createElement("p");

        coordinates.textContent =
            `Координати: ${city.lat}, ${city.lon}`;

        const time = document.createElement("small");

        time.textContent = `Оновлено: ${city.time}`;

        const deleteButton = document.createElement("button");

        deleteButton.textContent = "Видалити";
        // Видалення міста з IndexedDB
        deleteButton.addEventListener("click", async () => {

            try {

                await deleteItem(city.id);

                await refreshSavedCities();

                console.log("Місто видалено:", city.name);

            } catch (error) {

                console.error("Помилка видалення:", error);

                storageError.textContent =
                    "Не вдалося видалити місто.";

                storageError.style.display = "block";
            }
        });

        card.append(
            name,
            temperature,
            coordinates,
            time,
            deleteButton
        );

        savedCitiesList.append(card);
    });
}

// Оновлення списку міст із IndexedDB
async function refreshSavedCities() {

    savedCities = await getAllItems();

    renderSavedCities(savedCities);
}

// Початкова ініціалізація збережених міст
async function initSavedCities() {

    try {

        await openDB();

        await migrateLocalStorageToIndexedDB();

        await refreshSavedCities();

        storageError.style.display = "none";

    } catch (error) {

        console.error("Помилка роботи IndexedDB:", error);

        storageError.textContent =
            "Не вдалося відкрити базу даних. Збереження міст недоступне.";

        storageError.style.display = "block";
    }
}


saveCityButton.addEventListener("click", saveCity);

initSavedCities();

function WeatherCard({
    day,
    tempC,
    description,
    icon,
    showFahrenheit,
    onToggle
}) {

    const tempF = (tempC * 9) / 5 + 32;

    return (
        <article
            className={`forecast-card ${tempC <= 10 ? "cold" : ""}`}
            onClick={onToggle}
            role="button"
            tabIndex="0"
            onKeyDown={(event) => {

                if (event.key === "Enter" || event.key === " ") {

                    event.preventDefault();

                    onToggle();
                }
            }}
        >

            <h3>{day}</h3>

            <img
                className="forecast-icon"
                src={`https://openweathermap.org/img/wn/${icon}@2x.png`}
                alt={description}
            />

            <p>
                {tempC}°C

                {showFahrenheit && ` / ${tempF.toFixed(1)}°F`}
            </p>

            <p>{description}</p>

            <small>Натисніть, щоб показати °F</small>

        </article>
    );
}


function WeatherApp() {

    const [forecastData, setForecastData] = React.useState([]);

    const [averageTemp, setAverageTemp] = React.useState(null);

    const [forecastError, setForecastError] = React.useState("");

    const [loading, setLoading] = React.useState(false);


    function toggleFahrenheit(id) {

        setForecastData(currentData =>

            currentData.map(item =>

                item.id === id

                    ? {
                        ...item,
                        showFahrenheit: !item.showFahrenheit
                    }

                    : item
            )
        );
    }


    async function getForecast(city) {

        setLoading(true);

        setForecastError("");

        try {

            const response = await fetch(
                `${forecastUrl}${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
            );

            const data = await response.json();

            if (!response.ok) {

                throw new Error(
                    data.message || "Не вдалося отримати прогноз"
                );
            }

            const newForecastData = data.list

                .filter((item, index) => index % 4 === 0)

                .slice(0, 7)

                .map(item => ({

                    id: item.dt,

                    day: new Date(item.dt * 1000).toLocaleString("uk-UA", {

                        day: "2-digit",

                        month: "2-digit",

                        hour: "2-digit",

                        minute: "2-digit"
                    }),

                    tempC: Math.round(item.main.temp),

                    description:
                        weatherTranslations[item.weather[0].description] ||
                        item.weather[0].description,

                    icon: item.weather[0].icon,

                    showFahrenheit: false
                }));

            setForecastData(newForecastData);

            if (newForecastData.length > 0) {

                const total = newForecastData.reduce(

                    (sum, item) => sum + item.tempC,

                    0
                );

                setAverageTemp(
                    (total / newForecastData.length).toFixed(1)
                );

            } else {

                setAverageTemp(null);
            }

            console.log("Масив даних прогнозу:", newForecastData);

        } catch (err) {

            console.error("Помилка отримання прогнозу:", err);

            setForecastData([]);

            setAverageTemp(null);

            setForecastError(
                "Не вдалося завантажити прогноз погоди."
            );

        } finally {

            setLoading(false);
        }
    }


    React.useEffect(() => {

        function handleWeatherSearch(event) {

            getForecast(event.detail);
        }

        document.addEventListener(
            "weather-search",
            handleWeatherSearch
        );

        return () => {

            document.removeEventListener(
                "weather-search",
                handleWeatherSearch
            );
        };

    }, []);


    return (

        <div>

            <h2 className="title">Прогноз погоди</h2>

            {loading && <p>Завантаження прогнозу...</p>}

            {forecastError && (
                <p className="error">{forecastError}</p>
            )}

            {!loading && !forecastError && forecastData.length === 0 && (

                <p>
                    Введіть назву міста, щоб побачити прогноз.
                </p>
            )}

            {forecastData.length > 0 && (

                <>

                    <p id="avg-temp">
                        Середня температура: {averageTemp}°C
                    </p>

                    <div className="forecast-grid">

                        {forecastData.map(item => (

                            <WeatherCard
                                key={item.id}
                                day={item.day}
                                tempC={item.tempC}
                                description={item.description}
                                icon={item.icon}
                                showFahrenheit={item.showFahrenheit}
                                onToggle={() => toggleFahrenheit(item.id)}
                            />

                        ))}

                    </div>

                </>
            )}

        </div>
    );
}


const forecastRoot = ReactDOM.createRoot(
    document.querySelector("#forecast")
);

forecastRoot.render(<WeatherApp />);

weatherSearchForm.addEventListener("submit", event => {

    event.preventDefault();

    searchCity();
});


async function searchCity() {

    const city = cityInput.value.trim();

    if (!city) {

        cityInput.setCustomValidity("Введіть назву міста.");

        cityInput.reportValidity();

        return;
    }

    cityInput.setCustomValidity("");

    const data = await getWeather(city);

    if (!data) {
        return;
    }

    document.dispatchEvent(

        new CustomEvent("weather-search", {

            detail: data.name
        })
    );

    weatherSearchForm.reset();
}


cityInput.addEventListener("input", () => {

    if (cityInput.value.trim() === "") {

        cityInput.setCustomValidity("Введіть назву міста.");

    } else {

        cityInput.setCustomValidity("");
    }
});

function renderRecords(records) {

    recordsList.replaceChildren();

    records.forEach(record => {

        const card = document.createElement("article");

        card.classList.add("forecast-card");

        const dayTitle = document.createElement("h3");

        dayTitle.textContent = record.day;

        const temperature = document.createElement("p");

        temperature.textContent = `${record.tempC}°C`;

        const description = document.createElement("p");

        description.textContent =
            record.description || "Опис відсутній";

        card.append(
            dayTitle,
            temperature,
            description
        );

        recordsList.append(card);
    });
}


weatherForm.addEventListener("submit", event => {

    event.preventDefault();

    const day = dayInput.value.trim();

    const tempC = Number(tempInput.value);

    const description = descriptionInput.value.trim();

    const newRecord = {

        day: day,

        tempC: tempC,

        description: description
    };

    weatherRecords.push(newRecord);

    renderRecords(weatherRecords);

    weatherForm.reset();

    tempInput.setCustomValidity("");

    hottestDayResult.textContent = "";
});


tempInput.addEventListener("input", () => {

    if (

        tempInput.value !== "" &&

        (

            Number(tempInput.value) < -50 ||

            Number(tempInput.value) > 50
        )

    ) {

        tempInput.setCustomValidity(
            "Температура поза реалістичним діапазоном"
        );

    } else {

        tempInput.setCustomValidity("");
    }
});


hottestDayButton.addEventListener("click", () => {

    if (weatherRecords.length === 0) {

        hottestDayResult.textContent =
            "Спочатку додайте запис про погоду.";

        return;
    }

    const hottestDay = weatherRecords.reduce((max, record) => {

        return record.tempC > max.tempC ? record : max;
    });

    hottestDayResult.textContent =

        `Найтепліший день: ${hottestDay.day}, ` +

        `${hottestDay.tempC}°C. ${hottestDay.description}`;
});

const API_URL =
    "https://api.open-meteo.com/v1/forecast?latitude=50.45&longitude=30.52&current=temperature_2m,weather_code&timezone=auto";


const updateWeatherButton =
    document.querySelector("#update-weather-button");

const loadingMessage =
    document.querySelector("#loading-message");

const apiError =
    document.querySelector("#api-error");

const apiTemperature =
    document.querySelector("#api-temperature");

const apiDescription =
    document.querySelector("#api-description");

const apiTime =
    document.querySelector("#api-time");

const weatherCanvas = document.querySelector("#weather-canvas");
const ctx = weatherCanvas.getContext("2d");

const weatherCodes = {

    0: "Ясно",

    1: "Переважно ясно",

    2: "Мінлива хмарність",

    3: "Похмуро",

    45: "Туман",

    48: "Паморозевий туман",

    51: "Легка мряка",

    53: "Помірна мряка",

    55: "Сильна мряка",

    56: "Легка крижана мряка",

    57: "Сильна крижана мряка",

    61: "Невеликий дощ",

    63: "Помірний дощ",

    65: "Сильний дощ",

    66: "Легкий крижаний дощ",

    67: "Сильний крижаний дощ",

    71: "Невеликий сніг",

    73: "Помірний сніг",

    75: "Сильний сніг",

    77: "Снігові зерна",

    80: "Невеликий дощ",

    81: "Помірний дощ",

    82: "Сильна злива",

    85: "Невеликий снігопад",

    86: "Сильний снігопад",

    95: "Гроза",

    96: "Гроза з невеликим градом",

    99: "Гроза із сильним градом"
};

// Змінні для керування анімацією
let animationFrameId = null;
let currentWeatherCode = null;
let weatherParticles = [];

// Визначаємо тип погоди за реальним погодним кодом
function getWeatherType(code) {
    if (code === 0 || code === 1) {
        return "sun";
    }

    if ([2, 3, 45, 48].includes(code)) {
        return "cloud";
    }

    if (
        (code >= 51 && code <= 67) ||
        (code >= 80 && code <= 82) ||
        (code >= 95 && code <= 99)
    ) {
        return "rain";
    }

    if (
        (code >= 71 && code <= 77) ||
        code === 85 ||
        code === 86
    ) {
        return "snow";
    }

    return "cloud";
}

// Створюємо частинки для дощу або снігу
function createWeatherParticles(type) {
    const particles = [];

    const count = type === "rain" ? 45 : 35;

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * weatherCanvas.width,
            y: Math.random() * weatherCanvas.height,
            speed: type === "rain"
                ? 4 + Math.random() * 4
                : 1 + Math.random() * 2,
            size: type === "rain"
                ? 2 + Math.random() * 2
                : 2 + Math.random() * 3
        });
    }

    return particles;
}

// Малюємо сонце
function drawSun(time) {
    const x = 300;
    const y = 85;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 0.0005);

    ctx.strokeStyle = "#ffb74d";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";

    for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);

        ctx.beginPath();
        ctx.moveTo(0, -42);
        ctx.lineTo(0, -55);
        ctx.stroke();
    }

    ctx.restore();

    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fillStyle = "#ffb74d";
    ctx.fill();
}

// Малюємо хмару
function drawCloud(time) {
    const x = 300 + Math.sin(time * 0.0005) * 35;
    const y = 85;

    ctx.fillStyle = "#90a4ae";

    ctx.beginPath();
    ctx.arc(x - 30, y, 22, 0, Math.PI * 2);
    ctx.arc(x, y - 15, 30, 0, Math.PI * 2);
    ctx.arc(x + 30, y, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillRect(x - 30, y - 2, 60, 24);
}

// Малюємо дощ
function drawRain() {
    ctx.strokeStyle = "#2196f3";
    ctx.lineWidth = 2;

    weatherParticles.forEach(particle => {
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particle.x - 4, particle.y + 10);
        ctx.stroke();

        particle.y += particle.speed;

        if (particle.y > weatherCanvas.height) {
            particle.y = -10;
            particle.x = Math.random() * weatherCanvas.width;
        }
    });
}

// Малюємо сніг
function drawSnow() {
    ctx.fillStyle = "#ffffff";

    weatherParticles.forEach(particle => {
        ctx.beginPath();
        ctx.arc(
            particle.x,
            particle.y,
            particle.size,
            0,
            Math.PI * 2
        );
        ctx.fill();

        particle.y += particle.speed;
        particle.x += Math.sin(particle.y * 0.02) * 0.5;

        if (particle.y > weatherCanvas.height) {
            particle.y = -5;
            particle.x = Math.random() * weatherCanvas.width;
        }
    });
}

// Очищаємо Canvas та малюємо новий кадр
function animateWeather(time) {
    ctx.clearRect(
        0,
        0,
        weatherCanvas.width,
        weatherCanvas.height
    );

    // Малюємо фон
    ctx.fillStyle = "#e3f2fd";
    ctx.fillRect(
        0,
        0,
        weatherCanvas.width,
        weatherCanvas.height
    );

    const weatherType = getWeatherType(currentWeatherCode);

    // Відображаємо відповідну погодну анімацію
    if (weatherType === "sun") {
        drawSun(time);
    } else if (weatherType === "cloud") {
        drawCloud(time);
    } else if (weatherType === "rain") {
        drawCloud(time);
        drawRain();
    } else if (weatherType === "snow") {
        drawCloud(time);
        drawSnow();
    }

    // Плануємо наступний кадр
    animationFrameId = requestAnimationFrame(animateWeather);
}

// Запускаємо анімацію відповідно до погодного коду
function startWeatherAnimation(weatherCode) {
    // Зупиняємо попередню анімацію
    stopWeatherAnimation();

    currentWeatherCode = weatherCode;

    const weatherType = getWeatherType(weatherCode);

    // Створюємо частинки, якщо є опади
    if (weatherType === "rain" || weatherType === "snow") {
        weatherParticles = createWeatherParticles(weatherType);
    } else {
        weatherParticles = [];
    }

    // Запускаємо цикл анімації
    animationFrameId = requestAnimationFrame(animateWeather);
}

// Зупиняємо анімацію
function stopWeatherAnimation() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function renderWeather(data) {

    const temperature = data.current.temperature_2m;

    const weatherCode = data.current.weather_code;

    const time = data.current.time;

    startWeatherAnimation(weatherCode);

    const description =
        weatherCodes[weatherCode] || "Невідомі погодні умови";

    apiTemperature.textContent =
        `Температура: ${temperature}°C`;

    apiDescription.textContent =
        `Погодні умови: ${description}`;

    apiTime.textContent =
        `Час оновлення: ${time}`;
}


async function loadData() {

    loadingMessage.style.display = "block";

    loadingMessage.textContent = "Завантаження...";

    apiError.style.display = "none";

    updateWeatherButton.disabled = true;

    try {

        const response = await fetch(API_URL);

        if (!response.ok) {

            throw new Error(
                `Сервер відповів кодом ${response.status}`
            );
        }

        const data = await response.json();

        console.log("Дані Open-Meteo API:", data);

        renderWeather(data);

    } catch (error) {

        console.error(
            "Помилка отримання прогнозу погоди:",
            error
        );

        apiError.textContent =
            "Не вдалося отримати прогноз погоди";

        apiError.style.display = "block";

    } finally {

        loadingMessage.style.display = "none";

        updateWeatherButton.disabled = false;
    }
}


updateWeatherButton.addEventListener("click", loadData);

loadData();

window.addEventListener("beforeunload", stopWeatherAnimation);