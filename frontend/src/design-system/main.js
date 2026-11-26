import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import 'ant-design-vue/dist/reset.css'
import '../style.css'
import './design-system.css'
import DesignSystemApp from './DesignSystemApp.vue'

// The preview owns its local navigation state and never calls /api or the login bootstrap.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/design-system' },
    { path: '/design-system', component: DesignSystemApp },
    { path: '/:pathMatch(.*)*', redirect: '/design-system' },
  ],
})

createApp(DesignSystemApp).use(router).mount('#app')
