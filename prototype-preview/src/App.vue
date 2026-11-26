<script setup>
// Trimmed host shell from release App.vue: no login (preview auto-bootstraps a mock user),
// same ConfigProvider theme, sidebar, topbar and AlarmDetail dialog.
import { ConfigProvider as AConfigProvider, Alert as AAlert, Button as AButton, Select as ASelect, SelectOption as ASelectOption } from 'ant-design-vue'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { state, bootstrap, t, language, changeLanguage } from './state'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import zhTW from 'ant-design-vue/es/locale/zh_TW'
import enUS from 'ant-design-vue/es/locale/en_US'
import AlarmDetail from './components/AlarmDetail.vue'
import AppSidebar from './components/AppSidebar.vue'
const route = useRoute(), ready = ref(false)
onMounted(async () => { await bootstrap(); ready.value = true })
</script>
<template>
  <a-config-provider :auto-insert-space-in-button="false" :locale="({ 'zh-CN': zhCN, 'zh-TW': zhTW, en: enUS })[language]" :theme="{ token: { colorPrimary: '#167d92', borderRadius: 6, fontSize: 13 } }">
  <div v-if="!ready" class="splash">AMS · {{ t('载入中') }}</div>
  <div v-else class="app-shell">
    <AppSidebar/>
    <div class="main-shell"><header class="topbar"><span class="muted">CHANGXIN / {{ t('警报管理系统') }}</span><div class="top-actions">
      <a-select :value="language" @change="changeLanguage($event)" aria-label="语言"><a-select-option value="zh-CN">简体中文</a-select-option><a-select-option value="zh-TW">繁體中文</a-select-option><a-select-option value="en">English</a-select-option></a-select>
      <RouterLink to="/page/ACK_LIST" class="inbox-link">待我确认</RouterLink><span class="avatar">{{ state.user?.USER_NAME?.slice(-1) }}</span><span>{{ state.user?.USER_NAME }}</span>
      <span class="preview-badge">PREVIEW</span>
    </div></header>
    <main><RouterView/></main><footer class="page-footer">AMS · 原型工程演示<span>Host: local mock</span></footer></div>
    <AlarmDetail/>
  </div>
  <a-alert v-if="state.error" class="global-error" :message="state.error" type="error" role="alert" show-icon closable @close="state.error = ''"/>
  <div v-if="state.busy" class="loading-bar" role="progressbar" aria-label="载入中"/>
  <a-alert v-if="state.toast" class="toast" :message="t(state.toast)" type="success" show-icon role="status"/>
  </a-config-provider>
</template>
<style scoped>.preview-badge{font-size:9px;letter-spacing:1px;color:#a0710b;background:#fff5dc;border-radius:4px;padding:3px 7px}</style>
