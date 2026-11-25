import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import Workspace from './pages/Workspace.vue'
import 'ant-design-vue/dist/reset.css'
import './style.css'
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/home', component: Workspace, props: { code: 'HOME' } },
    { path: '/page/:code', component: Workspace, props: true },
    { path: '/alarm/:key', component: Workspace, props: route => ({ code: 'ACK', alarmKey: route.params.key }) },
    { path: '/ack/:key', component: Workspace, props: route => ({ code: 'ACK', alarmKey: route.params.key }) },
    { path: '/:pathMatch(.*)*', redirect: '/home' },
  ],
})
createApp(App).use(router).mount('#app')
