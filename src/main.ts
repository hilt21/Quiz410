import { createApp } from 'vue';
import App from './App.vue';
import './style.css';
createApp(App).mount('#app');
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .catch(() => {
        /* Offline availability is reported by actual loading results. */
      });
  });
}
