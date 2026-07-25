import { createApp } from 'vue';
import 'tippy.js/dist/tippy.css';
import VueTippy from 'vue-tippy';
import './style.css';
import App from './App.vue';

const app = createApp(App);

app.use(VueTippy);
app.mount('#app');
