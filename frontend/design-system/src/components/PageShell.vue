<script setup>
/** AMS application frame for business compositions: AppSidebar + 68px topbar + content. */
import AppSidebar from './AppSidebar.vue'
defineProps({
  activePath: { type: String, default: '/page/AVPA013' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  links: { type: Array, default: () => [] },
  userName: { type: String, default: '演示使用者' },
  startCollapsed: { type: Boolean, default: true },
})
const emit = defineEmits(['navigate'])
</script>
<template>
  <div class="app-shell">
    <AppSidebar :links="links" :active-path="activePath" :start-collapsed="startCollapsed" preference-key="ams.pattern.sidebar" @navigate="emit('navigate', $event)"/>
    <div class="main-shell">
      <header class="topbar">
        <span class="muted">CHANGXIN / 警报管理系统</span>
        <div class="top-actions"><span class="inbox-link">待我确认</span><span class="avatar">{{ userName.slice(-1) }}</span><span>{{ userName }}</span><a-button>登出</a-button></div>
      </header>
      <main>
        <div v-if="title" class="page-heading"><div><div class="eyebrow">DESIGN SYSTEM · PATTERN</div><h1>{{ title }}</h1><p v-if="description" class="description" style="margin-top:6px">{{ description }}</p></div><span class="badge-local"><i/>LOCAL MOCK</span></div>
        <slot/>
      </main>
      <footer class="page-footer" style="padding:10px 28px;display:flex;justify-content:space-between;color:#9aa8b4;font-size:10px;border-top:1px solid #dde5ed">AMS · 本地演示<span>Email · SMTP 未配置</span></footer>
    </div>
  </div>
</template>
