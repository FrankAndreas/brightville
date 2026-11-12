import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { localSaveStore } from './services/storage'
import { usePlayerStore } from './stores/player'

const pinia = createPinia()
usePlayerStore(pinia).init(localSaveStore())
createApp(App).use(pinia).mount('#app')
