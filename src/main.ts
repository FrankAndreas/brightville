import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { httpApi } from './services/api'
import { useSessionStore } from './stores/session'

// The hub says on any answer when its login is in its last week; the page then passes through the hub once,
// while the child walks around in the town (App.vue)
const pinia = createPinia()
const session = useSessionStore(pinia)
const api = httpApi(undefined, () => session.wantRenew())
void session.start(api)
createApp(App, { api }).use(pinia).mount('#app')
