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

LinkedIn-профиль напрямую из среды сборки был недоступен, поэтому контент собран из открытых источников:

- Senior Performance Manager, Front Row Germany, Hamburg
- Публикация Front Row Germany в серии **#TipDrop**: связка DSP, CTV и Sponsored Ads в одну
  audience story, AMC для видимости кросс-канального эффекта, платформа CATAPULT, 360° brand view
- Профильная экспертиза: Amazon DSP, AMC, reporting, campaign structure, strategic planning

Выдуманных цифр (ROAS, бюджеты, годы) на сайте нет. Счётчики в блоке About отражают
метод, а не результаты.

## Что дописать (весь текст — в `index.html`)

- Блок **Experience**: прошлые роли (продублировать `<article class="job">`)
- Реальные подтверждённые результаты, если их можно публиковать (заменить/добавить `.stat`)
- Email или другой контакт в блоке **Contact**
- Фото, при желании
