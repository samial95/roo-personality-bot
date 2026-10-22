import './styles/tokens.css';
import './styles/base.css';

const ICON_HOME =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>';
const ICON_SOUND_OFF =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="topbar">
    <a class="logo" href="./" aria-label="pip home"><span class="logo-mark" aria-hidden="true"></span>pip</a>
    <div class="topbar-actions">
      <button class="icon-btn" data-action="home" aria-label="Home">${ICON_HOME}</button>
      <button class="icon-btn" data-action="sound" aria-label="Sound off" aria-pressed="false">${ICON_SOUND_OFF}</button>
    </div>
  </header>
  <div class="stage" aria-hidden="true"></div>
  <main class="content">
    <h1>Hi. I'm Pip.<br />I don't have a personality yet.</h1>
    <p class="body">3 questions. A whole new me.</p>
    <button class="btn-primary">Give me a personality <span aria-hidden="true">→</span></button>
  </main>
`;
