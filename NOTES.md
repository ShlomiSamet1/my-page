# Notes

## index.html

Page structure and content. Sticky header (logo, nav, theme toggle), hero (name, tagline, bio, CTAs), Journey section (stats row + timeline of roles with skills), Contact section (email link + form) and footer. Loads `style.css`, `script.js` and `contact-form.js`; a small inline script applies the saved theme before first paint.

## style.css

All visual styling. Colours are CSS variables in `:root`, overridden by `[data-theme="light"]`; dark is the default. Gold gradients (champagne, gold, rose gold, bronze) are applied to text via `background-clip: text` and to lines via `linear-gradient`. Includes the name shimmer and entrance keyframes, a viewport-based hero that fits one screen, a mobile breakpoint, and a `prefers-reduced-motion` block that disables animations.

## script.js

Page behaviour. Toggles the theme and saves it in `localStorage`. Uses `IntersectionObserver` to fade in sections, highlight the active nav link, and run the stats count-up (`requestAnimationFrame`, ease-out). Animations are skipped under reduced motion.

## contact-form.js

Client-side form validation. Each field has a validator (name, optional pronouns, email, reason from a whitelist, message 20–1000 chars); errors show under the field via `aria-live`, and a live character counter tracks the message. Input is sanitised and rendered only as text. Sending is simulated with a timed `Promise`; no data leaves the browser yet.
