import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import HomePage from './pages/HomePage.vue'
import Workspace from './pages/Workspace.vue'
import 'ant-design-vue/dist/reset.css'
import './style.css'
import { installPreviewStyles } from './style.js'
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/home', component: HomePage },
    { path: '/page/:code', component: Workspace, props: true },
    { path: '/:pathMatch(.*)*', redirect: '/home' },
  ],
})
installPreviewStyles()
createApp(App).use(router).mount('#app')
