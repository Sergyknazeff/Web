# Sergii Kniaziev — personal site

Одностраничный сайт-портфолио. Локальный проект, без хостинга.

## Запуск

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production-сборка в dist/
npm run preview  # просмотр сборки
```

Нужен Node 18+.

## Стек и эффекты

- **Vite** — сборка
- **Three.js** — WebGL-шейдер в hero (domain-warped fbm «жидкий шёлк», линза за курсором, растворение при скролле)
- **GSAP** (ScrollTrigger, SplitText, DrawSVG, MotionPath) — все анимации
- **Lenis** — плавный скролл

Эффекты: прелоадер со счётчиком и шторкой, побуквенное появление имени, кастомный курсор с подписями,
магнитные кнопки, бегущая строка, реагирующая на скорость скролла, подсветка текста «About» по словам,
закреплённый горизонтальный скролл карточек с 3D-наклоном и spotlight, рисующаяся схема
DSP/CTV/Sponsored Ads/Organic → AMC → Budget/Creative/Strategy с бегущими импульсами данных,
счётчики, зерно поверх страницы. Учитывается `prefers-reduced-motion`; на мобильных горизонтальный скролл
заменяется вертикальным.

## Откуда контент

Основной источник — CV (Retail Media & Programmatic Lead): все роли, даты, цифры
(9+ лет, 12 рынков, 3 агентства, команда из 4, 2 из топ-5 глобальных клиентов) и навыки взяты оттуда.
Дополнительно из открытых источников — публикация Front Row Germany **#TipDrop**.
Выдуманных метрик на сайте нет.

## Структура

Hero → платформы (бегущая строка) → About + 4 стороны экосистемы → Expertise (горизонтальный скролл)
→ Method (схема AMC clean room) → Journey (маршрут Bratislava → London → Frankfurt → Toronto → Hamburg)
→ #TipDrop → Experience (6 ролей, таймлайн) → Toolkit / языки / обучение → Contact.

Весь текст — в `index.html`.
