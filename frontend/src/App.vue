<script setup>
import { ConfigProvider as AConfigProvider, Alert as AAlert, Button as AButton, Input as AInput, Select as ASelect, SelectOption as ASelectOption } from 'ant-design-vue'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { state, api, act, bootstrap, t, language, changeLanguage } from './state'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import zhTW from 'ant-design-vue/es/locale/zh_TW'
import enUS from 'ant-design-vue/es/locale/en_US'
import AlarmDetail from './components/AlarmDetail.vue'
import AppSidebar from './components/AppSidebar.vue'
const route = useRoute(), router = useRouter()
const credentials = ref({ userId: 'E0043258', password: '' }), ready = ref(false)
async function login() {
  await act(async () => {
    const result = await api('/login', credentials.value); sessionStorage.setItem('ams_java_token', result.token)
    credentials.value.password = ''
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
  <a-config-provider :auto-insert-space-in-button="false" :locale="({ 'zh-CN': zhCN, 'zh-TW': zhTW, en: enUS })[language]" :theme="{ token: { colorPrimary: '#167d92', borderRadius: 6, fontSize: 13 } }">
  <div v-if="!ready" class="splash">AMS · {{ t('载入中') }}</div>
  <div v-else-if="!state.user" class="login-screen">
    <section class="login-brand"><div class="brandmark">A<span>MS</span></div><p>ALARM MANAGEMENT SYSTEM</p><h1>让每一次警报<br>都有明确回应。</h1><p>厂区共享警报管理平台</p><div class="login-flow"><span>接收</span> → <span>通知</span> → <span>确认</span> → <span>闭环</span></div></section>
    <form class="login-card" @submit.prevent="login"><small>CHANGXIN · AMS</small><h2>{{ t('登入') }}</h2><p class="muted">Java + Vue · 本地演示环境</p>
      <label>{{ t('使用者代码') }}<a-input v-model:value="credentials.userId" autocomplete="username" required/></label>
      <label>{{ t('密码') }}<a-input v-model:value="credentials.password" type="password" autocomplete="current-password" required/></label>
      <a-alert v-if="state.error" :message="state.error" type="error" show-icon role="alert"/>
      <a-button class="primary" :disabled="state.busy > 0" type="primary" html-type="submit">{{ state.busy ? t('载入中') : t('登入') }}</a-button>
      <div class="demo-users"><span>{{ t('演示账号') }}</span><a-button v-for="(name,id) in { E0043258:'系统管理员',E0043288:'值班主管',E0043271:'制程工程师' }" :key="id" @click="credentials = { userId:id,password:'' }" type="default" html-type="button">{{ t(name) }}</a-button></div>
    </form>
  </div>
  <div v-else class="app-shell">
    <AppSidebar/>
    <div class="main-shell"><header class="topbar"><span class="muted">CHANGXIN / {{ t('警报管理系统') }}</span><div class="top-actions">
      <a-select :value="language" @change="changeLanguage($event)" aria-label="语言"><a-select-option value="zh-CN">简体中文</a-select-option><a-select-option value="zh-TW">繁體中文</a-select-option><a-select-option value="en">English</a-select-option></a-select>
      <RouterLink to="/page/ACK_LIST" class="inbox-link">待我确认</RouterLink><span class="avatar">{{ state.user.USER_NAME?.slice(-1) }}</span><span>{{ state.user.USER_NAME }}</span><a-button @click="logout" type="default" html-type="button">{{ t('登出') }}</a-button>
    </div></header>
    <main>
      <RouterView :key="route.fullPath"/>
    </main><footer class="page-footer">AMS · {{ t('登入时间') }} {{ new Date(state.loginAt).toLocaleString() }}<span>Email · {{ state.smtpConfigured?'SMTP 已配置':'SMTP 未配置' }}</span></footer></div>
    <AlarmDetail/>
  </div>
  <a-alert v-if="state.user && state.error" class="global-error" :message="state.error" type="error" role="alert" show-icon closable @close="state.error = ''"/>
  <div v-if="state.busy" class="loading-bar" role="progressbar" aria-label="载入中"/>
  <a-alert v-if="state.toast" class="toast" :message="t(state.toast)" type="success" show-icon role="status"/>
  </a-config-provider>
</template>
