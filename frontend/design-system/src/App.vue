<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import { ConfigProvider } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { mock, mockState, notify } from './composables/useMockData.js'

const routes = {
  '/': defineAsyncComponent(() => import('./views/HomeView.vue')),
  '/foundation/tokens': defineAsyncComponent(() => import('./views/TokensView.vue')),
  '/components/table': defineAsyncComponent(() => import('./views/TableComponentsView.vue')),
  '/components/form': defineAsyncComponent(() => import('./views/FormComponentsView.vue')),
  '/components/feedback': defineAsyncComponent(() => import('./views/FeedbackView.vue')),
  '/components/ams': defineAsyncComponent(() => import('./views/AmsComponentsView.vue')),
  '/components/catalog': defineAsyncComponent(() => import('./views/ProductsView.vue')),
  '/business/master': defineAsyncComponent(() => import('./views/MasterEditView.vue')),
  '/business/query': defineAsyncComponent(() => import('./views/QueryTableView.vue')),
  '/business/alarm': defineAsyncComponent(() => import('./views/AlarmDetailView.vue')),
  '/routes': defineAsyncComponent(() => import('./views/RoutesView.vue')),
}

function currentPath() {
  const raw = decodeURIComponent(window.location.hash.replace(/^#/, '') || '/')
  return raw.split('?')[0] || '/'
}
const path = ref(currentPath())
window.addEventListener('hashchange', () => { path.value = currentPath() })
const page = computed(() => routes[path.value] || routes['/'])
const pageKey = computed(() => (routes[path.value] ? path.value : '/'))
const isLocal = computed(() => mock.meta.mock === true)
const links = [
  { href: '#/', label: '概览' },
  { href: '#/foundation/tokens', section: 'Foundation', label: 'Design tokens' },
  { href: '#/components/catalog', section: 'Ant Design Vue', label: '组件目录' },
  { href: '#/components/table', section: 'Ant Design Vue', label: 'Table / 表格' },
  { href: '#/components/form', section: 'Ant Design Vue', label: 'Form / 表单' },
  { href: '#/components/feedback', section: 'Ant Design Vue', label: 'Feedback / 反馈' },
  { href: '#/components/ams', section: 'AMS 组件', label: '五件套公共组件' },
  { href: '#/business/master', section: '业务组合', label: '主档编辑' },
  { href: '#/business/query', section: '业务组合', label: '条件查询与结果表格' },
  { href: '#/business/alarm', section: '业务组合', label: '告警详情' },
  { href: '#/routes', section: '索引', label: '路由与映射' },
]
const grouped = computed(() => {
  const result = []
  for (const link of links) {
    const section = link.section || ''
    if (!result.some(group => group.section === section)) result.push({ section, items: [] })
    result.find(group => group.section === section).items.push(link)
  }
  return result
})
function go(to) { window.location.hash = `#${to}` }
function showToast(message) { notify(message) }

const theme = { token: { colorPrimary: '#167d92', borderRadius: 6, fontSize: 13 } }
</script>
<template>
  <ConfigProvider :locale="zhCN" :theme="theme" :auto-insert-space-in-button="false">
    <div class="gallery">
      <aside class="gallery-sidebar">
        <div class="gallery-brand">A<span>MS</span><span>DESIGN SYSTEM</span></div>
        <div style="padding:10px 8px 0"><span class="badge-local"><i/>LOCAL MOCK</span></div>
        <nav class="gallery-nav" aria-label="设计系统导航">
          <template v-for="group in grouped" :key="group.section || 'home'">
            <h4 v-if="group.section">{{ group.section }}</h4>
            <a v-for="link in group.items" :key="link.href" :href="link.href" :class="{ active: path === link.href.replace(/^#/, '') }">{{ link.label }}</a>
          </template>
        </nav>
        <div style="border-top:1px solid #263b50;margin:22px 8px 0;padding:16px 8px;font-size:10px;color:#7891a9;line-height:1.8">
          Ant Design Vue <b style="color:#b2c5d8">4.2.6</b><br>Vue 3.5 · 本地数据<br>
          <span style="color:#55c4a8">●</span> 不依赖 Java / 登录
        </div>
      </aside>
      <main class="gallery-content">
        <div v-if="!isLocal" class="notice" style="margin-bottom:16px">本页预期使用本地演示资料。</div>
        <component :key="pageKey" :is="page" @navigate="go" @notify="showToast"/>
      </main>
    </div>
    <a-alert v-if="mockState.toast" class="toast" :message="mockState.toast" type="success" show-icon role="status" style="position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:2000;min-width:240px;box-shadow:0 4px 25px #0002"/>
  </ConfigProvider>
</template>
