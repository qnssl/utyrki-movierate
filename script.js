// =================================================================
// 🚨🚨🚨 ЧАСТЬ 1: КОНСТАНТЫ И НАСТРОЙКИ (ОБЯЗАТЕЛЬНО ИЗМЕНИТЬ!) 🚨🚨🚨
// =================================================================

// 1. API ключ TMDb для поиска фильмов и постеров
const TMDB_API_KEY = '2b1d44caaa02a9f3425172dc8489ef1b'; 
// 2. Эндпоинт Sheety для взаимодействия с Google Таблицей
const SHEETY_API_ENDPOINT = 'https://api.sheety.co/431c7f183a47b67a3334370c987ec292/movieRateData/лист1'; 

// Ключи критериев, используемые в форме и таблице (должны совпадать с заголовками столбцов Google Sheets!)
const CRITERIA = [
    { key: "Zadumka", label: "Задумка" },
    { key: "Syuzhet", label: "Сюжет" },
    { key: "Igra", label: "Игра актеров" },
    { key: "S’emka", label: "Съемка (обобщенно)" }, // Внимание на апостроф в ключе, если вы его используете!
    { key: "Zhanr", label: "Приближенность к жанру" },
    { key: "Originalnost", label: "Оригинальность в сюжете" },
    { key: "Realistichnost", label: "Реалистичность/Логичность" }
];

// Ключи критериев, используемые для расчета общего среднего балла (используются в Sheety)
const CRITERIA_KEYS_FOR_CALC = [
    'Criterion_1_Zadumka', 'Criterion_2_Syuzhet', 'Criterion_3_Igra', 
    'Criterion_4_S’emka', 'Criterion_5_Zhanr', 'Criterion_6_Originalnost', 
    'Criterion_7_Realistichnost'
];

// =================================================================
// ЧАСТЬ 2: ЭЛЕМЕНТЫ DOM
// =================================================================

const searchInput = document.getElementById('movie-search');
const searchResultsDiv = document.getElementById('search-results');
const movieListDiv = document.getElementById('movie-list');
const modal = document.getElementById('rating-modal');
const closeButton = document.querySelector('.close-button');
const ratingForm = document.getElementById('rating-form');
const criteriaFieldsDiv = document.getElementById('criteria-fields');
const formMovieId = document.getElementById('form-movie-id');
const formMovieTitle = document.getElementById('form-movie-title');
const modalMovieTitle = document.getElementById('modal-movie-title');
const userRatingsListDiv = document.getElementById('user-ratings-list');


// =================================================================
// ЧАСТЬ 3: ФУНКЦИИ ПОИСКА И ИНТЕРАКТИВНОСТИ
// =================================================================

// Вспомогательная функция для задержки ввода (Debounce)
function debounce(func, timeout = 500){
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// -------------------------------------------------
// Поиск фильмов (TMDb)
// -------------------------------------------------

searchInput.addEventListener('input', debounce(handleMovieSearch));

async function handleMovieSearch(e) {
    const query = e.target.value.trim();
    searchResultsDiv.innerHTML = '';
    if (query.length < 3) return;

    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=ru-RU`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        data.results.slice(0, 5).forEach(movie => {
            const resultItem = document.createElement('div');
            resultItem.classList.add('search-result-item');
            // Отображаем название и год
            resultItem.textContent = `${movie.title} (${movie.release_date ? movie.release_date.substring(0, 4) : 'N/A'})`;
            
            resultItem.addEventListener('click', () => {
                searchResultsDiv.innerHTML = ''; // Скрываем результаты поиска
                // Открываем модальное окно с ID, названием и путем к постеру
                openRatingModal(movie.id, movie.title, movie.poster_path); 
            });
            searchResultsDiv.appendChild(resultItem);
        });
    } catch (error) {
        console.error('Ошибка поиска фильма:', error);
    }
}

// -------------------------------------------------
// Открытие/Закрытие Модального Окна
// -------------------------------------------------

function openRatingModal(movieId, movieTitle, posterPath) {
    // 1. Установка данных в форму
    formMovieId.value = movieId;
    formMovieTitle.value = movieTitle;
    modalMovieTitle.textContent = `Оценить фильм: ${movieTitle}`;
    
    // 2. Генерация полей критериев
    criteriaFieldsDiv.innerHTML = CRITERIA.map(c => `
        <div class="rating-item">
            <label>${c.label} (1-10):</label>
            <input type="number" name="${c.key}" min="1" max="10" value="5" required class="glow-input small-input">
        </div>
    `).join('');
    
    // 3. Отображение модального окна
    modal.style.display = 'block';

    // 4. Загрузка существующих оценок для этого фильма
    loadUserRatingsForMovie(movieId);
}

// Закрытие по кнопке "X"
closeButton.addEventListener('click', () => {
    modal.style.display = 'none';
});

// Закрытие при клике вне модального окна
window.addEventListener('click', (event) => {
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});


// =================================================================
// ЧАСТЬ 4: ЛОГИКА ОТПРАВКИ И ОТОБРАЖЕНИЯ ДАННЫХ
// =================================================================

// -------------------------------------------------
// Отправка оценки (POST к Sheety)
// -------------------------------------------------

ratingForm.addEventListener('submit', handleRatingSubmit);

async function handleRatingSubmit(e) {
    e.preventDefault();

    const data = new FormData(ratingForm);
    const body = {
        // Убедитесь, что 'sheet1' или 'ratings' соответствует имени вашего листа в Sheety!
        sheet1: { 
            MovieId: data.get('form-movie-id'),
            MovieTitle: data.get('form-movie-title'),
            UserName: data.get('user-name'),
            // Сопоставление критериев с именами столбцов в Google Таблице:
            Criterion_1_Zadumka: parseInt(data.get('Zadumka')),
            Criterion_2_Syuzhet: parseInt(data.get('Syuzhet')),
            Criterion_3_Igra: parseInt(data.get('Igra')),
            Criterion_4_S’emka: parseInt(data.get('S’emka')),
            Criterion_5_Zhanr: parseInt(data.get('Zhanr')),
            Criterion_6_Originalnost: parseInt(data.get('Originalnost')),
            Criterion_7_Realistichnost: parseInt(data.get('Realistichnost'))
        }
    };
    
    try {
        const response = await fetch(SHEETY_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            alert('Оценка успешно отправлена! Спасибо!');
            modal.style.display = 'none';
            // Обновляем главную страницу, чтобы показать новую оценку
            loadAllRatings(); 
        } else {
            alert('Ошибка при отправке оценки. Проверьте консоль.');
            console.error('Ошибка Sheety:', await response.json());
        }
    } catch (error) {
        console.error('Сетевая ошибка:', error);
    }
}


// -------------------------------------------------
// Загрузка и отображение всех оценок (GET от Sheety)
// -------------------------------------------------

async function loadAllRatings() {
    movieListDiv.innerHTML = '<p class="glow-text">Загрузка оценок...</p>';
    
    try {
        const response = await fetch(SHEETY_API_ENDPOINT);
        const data = await response.json();
        
        // Используйте имя вашего листа (например, data.sheet1 или data.ratings)
        const ratings = data.sheet1 || data.ratings; 

        if (!ratings || ratings.length === 0) {
            movieListDiv.innerHTML = '<p class="glow-text" style="font-size: 1.5em;">Пока нет оценок. Будьте первыми!</p>';
            return;
        }

        const moviesMap = {};

        // 1. Группировка оценок
        ratings.forEach(rating => {
            const movieId = rating.movieId; 
            
            if (!moviesMap[movieId]) {
                moviesMap[movieId] = {
                    title: rating.movieTitle,
                    ratings: [],
                    totalScore: 0
                };
            }
            moviesMap[movieId].ratings.push(rating);
        });

        movieListDiv.innerHTML = ''; 
        
        // 2. Расчет среднего балла и отрисовка
        for (const movieId in moviesMap) {
            const movie = moviesMap[movieId];
            
            let totalRatingSum = 0;
            let totalRatingCount = 0;

            movie.ratings.forEach(rating => {
                CRITERIA_KEYS_FOR_CALC.forEach(key => {
                    const score = rating[key];
                    if (score !== undefined && score !== null) {
                        totalRatingSum += score;
                        totalRatingCount++;
                    }
                });
            });

            const averageScore = totalRatingCount > 0 ? (totalRatingSum / totalRatingCount).toFixed(1) : 'N/A';
            
            // ⭐️ Запрос постера из TMDb и отображение карточки
            await fetchAndDisplayPoster(movieId, movie.title, averageScore);
        }

    } catch (error) {
        console.error('Ошибка загрузки или обработки оценок:', error);
        movieListDiv.innerHTML = '<p style="color: red;">Произошла ошибка при загрузке данных.</p>';
    }
}


// -------------------------------------------------
// Получение постера (TMDb) и отображение карточки
// -------------------------------------------------

async function fetchAndDisplayPoster(movieId, movieTitle, averageScore) {
    const tmdbUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&language=ru-RU`;

    try {
        const response = await fetch(tmdbUrl);
        const data = await response.json();

        const posterPath = data.poster_path;
        const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w300${posterPath}` : 'https://via.placeholder.com/300x450?text=Нет+постера'; 
        
        const movieCard = document.createElement('div');
        movieCard.classList.add('movie-card');
        movieCard.onclick = () => openRatingModal(movieId, movieTitle, posterPath); // Клик для оценки

        movieCard.innerHTML = `
            <img src="${posterUrl}" alt="${movieTitle} постер" class="poster">
            <div class="card-info">
                <h3>${movieTitle}</h3>
                <p class="score glow-text">Общая оценка: ${averageScore} / 10</p>
                <p class="click-info">Нажмите, чтобы оценить или посмотреть оценки</p>
            </div>
        `;
        movieListDiv.appendChild(movieCard);

    } catch (error) {
        console.error(`Ошибка при получении постера для ${movieTitle}:`, error);
    }
}


// -------------------------------------------------
// Загрузка оценок пользователей в модальном окне
// -------------------------------------------------

async function loadUserRatingsForMovie(targetMovieId) {
    userRatingsListDiv.innerHTML = '<p>Загрузка оценок друзей...</p>';

    try {
        const response = await fetch(SHEETY_API_ENDPOINT);
        const data = await response.json();
        
        const allRatings = data.sheet1 || data.ratings; 
        
        // Фильтрация оценок только для текущего фильма
        const movieRatings = allRatings.filter(r => String(r.movieId) === String(targetMovieId));
        
        if (movieRatings.length === 0) {
            userRatingsListDiv.innerHTML = '<p>Пока оценок нет. Будьте первыми, кто оценит этот фильм!</p>';
            return;
        }

        userRatingsListDiv.innerHTML = '';
        
        movieRatings.forEach(rating => {
            let detailsHtml = '';
            let totalUserScore = 0;
            let criteriaCount = 0;

            CRITERIA.forEach((c, index) => {
                const sheetKey = CRITERIA_KEYS_FOR_CALC[index];
                const score = rating[sheetKey] || 'N/A';
                
                if (score !== 'N/A') {
                    totalUserScore += score;
                    criteriaCount++;
                }

                detailsHtml += `<p>• ${c.label}: <span class="score-value">${score} / 10</span></p>`;
            });

            const personalAverage = criteriaCount > 0 ? (totalUserScore / criteriaCount).toFixed(1) : 'N/A';

            const ratingBlock = document.createElement('div');
            ratingBlock.classList.add('user-rating-block');

            ratingBlock.innerHTML = `
                <div class="user-info">
                    <strong>${rating.userName || 'Аноним'}</strong>
                    <span class="personal-score">(Средний: ${personalAverage})</span>
                </div>
                <div class="rating-details">
                    ${detailsHtml}
                </div>
            `;
            userRatingsListDiv.appendChild(ratingBlock);
        });

    } catch (error) {
        console.error('Ошибка загрузки оценок пользователей:', error);
        userRatingsListDiv.innerHTML = '<p style="color: red;">Ошибка загрузки оценок.</p>';
    }
}


// =================================================================
// ЧАСТЬ 5: ЗАПУСК
// =================================================================

// Запускаем загрузку всех оценок при полной загрузке страницы
document.addEventListener('DOMContentLoaded', loadAllRatings);
