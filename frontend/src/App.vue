<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { state, api, act, bootstrap, t, language, changeLanguage } from './state'
import AlarmDetail from './components/AlarmDetail.vue'
const route = useRoute(), router = useRouter()
const credentials = ref({ userId: 'E0043258', password: '123456' }), ready = ref(false), navSearch = ref('')
const flattened = computed(() => {
  const items = []
  function visit(nodes, depth = 0) {
    for (const node of nodes) {
      if (!navSearch.value || !node.path || `${node.id} ${node.name} ${t(node.name)}`.toLowerCase().includes(navSearch.value.toLowerCase())) items.push({ ...node, depth })
      visit(node.children || [], depth + 1)
    }
  }
  visit(state.nav)
  return items
})
async function login() {
  await act(async () => {
    const result = await api('/login', credentials.value); sessionStorage.setItem('ams_java_token', result.token)
    await bootstrap()
  })
}
async function logout() { await act(async () => { await api('/logout', {}); sessionStorage.removeItem('ams_java_token'); state.user = null; state.detail = null; await router.push('/home') }) }
onMounted(async () => {
  if (sessionStorage.getItem('ams_java_token')) await act(bootstrap)
  ready.value = true
})
</script>
<template>
  <div v-if="!ready" class="splash">AMS · {{ t('载入中') }}</div>
  <div v-else-if="!state.user" class="login-screen">
    <section class="login-brand"><div class="brandmark">A<span>MS</span></div><p>ALARM MANAGEMENT SYSTEM</p><h1>让每一次警报<br>都有明确回应。</h1><p>厂区共享警报管理平台</p><div class="login-flow"><span>接收</span> → <span>通知</span> → <span>确认</span> → <span>闭环</span></div></section>
    <form class="login-card" @submit.prevent="login"><small>CHANGXIN · AMS</small><h2>{{ t('登入') }}</h2><p class="muted">Java + Vue · 本地演示环境</p>
      <label>{{ t('使用者代码') }}<input v-model="credentials.userId" autocomplete="username" required></label>
      <label>{{ t('密码') }}<input v-model="credentials.password" type="password" autocomplete="current-password" required></label>
      <p v-if="state.error" class="error" role="alert">{{ state.error }}</p>
      <button class="primary" :disabled="state.busy > 0">{{ state.busy ? t('载入中') : t('登入') }}</button>
      <div class="demo-users"><span>{{ t('演示账号') }}</span><button type="button" v-for="(name,id) in { E0043258:'系统管理员',E0043288:'值班主管',E0043271:'制程工程师' }" :key="id" @click="credentials = { userId:id,password:'123456' }">{{ t(name) }}</button></div>
    </form>
  </div>
  <div v-else class="app-shell">
    <aside class="sidebar"><a href="#/home" class="brand">AMS <span>警报管理系统</span></a><div class="environment"><i/> 本地演示环境</div>
      <input v-model="navSearch" class="nav-search" placeholder="搜索功能 / 页面代码">
      <nav><template v-for="node in flattened" :key="node.key">
        <RouterLink v-if="node.path" :to="node.path.replace(/^#/, '')" :style="{ paddingLeft: `${16 + Math.max(0,node.depth - 1) * 12}px` }" :class="{ current: route.path === node.path.replace(/^#/, '') }"><span>{{ t(node.name) }}</span><small>{{ node.id === 'HOME' ? '⌂' : node.id }}</small></RouterLink>
        <div v-else class="nav-section">{{ t(node.name) }}</div>
      </template></nav><footer>AMS · JAVA / VUE<br><small>v1.0.0</small></footer>
    </aside>
    <div class="main-shell"><header class="topbar"><span class="muted">CHANGXIN / {{ t('警报管理系统') }}</span><div class="top-actions">
      <select :value="language" @change="changeLanguage($event.target.value)" aria-label="语言"><option value="zh-CN">简体中文</option><option value="zh-TW">繁體中文</option><option value="en">English</option></select>
      <RouterLink to="/page/ACK_LIST" class="inbox-link">待我确认</RouterLink><span class="avatar">{{ state.user.USER_NAME?.slice(-1) }}</span><span>{{ state.user.USER_NAME }}</span><button @click="logout">{{ t('登出') }}</button>
    </div></header>
    <main>
      <RouterView :key="route.fullPath"/>
    </main><footer class="page-footer">AMS · {{ t('登入时间') }} {{ new Date(state.loginAt).toLocaleString() }}<span>Email · {{ state.smtpConfigured?'SMTP 已配置':'SMTP 未配置' }}</span></footer></div>
    <AlarmDetail/>
  </div>
  <div v-if="state.user && state.error" class="error global-error" role="alert">{{ state.error }}<button @click="state.error = ''" aria-label="关闭错误">×</button></div>
  <div v-if="state.busy" class="loading-bar" role="progressbar" aria-label="载入中"/>
  <div v-if="state.toast" class="toast" role="status">{{ t(state.toast) }}</div>
</template>
