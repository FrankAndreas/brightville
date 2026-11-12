import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { httpApi } from './services/api'
import { renewOnce } from './services/renew'
import { useSessionStore } from './stores/session'

// The hub says on any answer when its login is in its last week; the page then passes through the hub once
let renewWanted = false
const api = httpApi(undefined, () => { renewWanted = true })

const pinia = createPinia()
const session = useSessionStore(pinia)
void session.start(api).then(() => {
  const loginUrl = session.me?.login_url
  if (renewWanted && loginUrl) renewOnce(loginUrl, url => window.location.assign(url))
})
createApp(App, { api }).use(pinia).mount('#app')
