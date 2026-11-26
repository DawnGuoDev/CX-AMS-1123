<script setup>
import { computed, h, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Button as AButton, Empty as AEmpty, Input as AInput, LayoutSider as ALayoutSider, Menu as AMenu, Tooltip as ATooltip } from 'ant-design-vue'
import {
  ApartmentOutlined, BellOutlined, DashboardOutlined, DatabaseOutlined, ExperimentOutlined,
  FileSearchOutlined, HistoryOutlined, InboxOutlined, LinkOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, SearchOutlined, SettingOutlined, TeamOutlined, ThunderboltOutlined,
  ToolOutlined, HomeOutlined, WarningOutlined,
} from '@ant-design/icons-vue'
import { state, t } from '../state'

const route = useRoute(), router = useRouter()
const storageKey = 'ams.sidebar.collapsed'
function savedPreference() {
  try { return localStorage.getItem(storageKey) === 'true' } catch { return false }
}
const collapsed = ref(savedPreference()), search = ref(''), searchInput = ref(null)
const openKeys = ref(['operations', 'basics'])
const groups = [
  { key: 'operations', label: '警报作业', icon: ThunderboltOutlined, codes: ['AVPA013', 'ALARM_LIST', 'ACK_LIST', 'TEST'] },
  { key: 'basics', label: '基础资料', icon: DatabaseOutlined, codes: ['SBRM_USER', 'SBRM_FACTORY', 'SBRM_EQP', 'AVMA003', 'AVMA004'] },
  { key: 'notifications', label: '通知配置', icon: BellOutlined, codes: ['AVMA007', 'AVMA009'] },
  { key: 'reports', label: '查询报表', icon: FileSearchOutlined, codes: ['AVPA004', 'AVPA007'] },
  { key: 'other', label: '其他功能', icon: SettingOutlined, codes: [] },
]
const icons = {
  AVPA013: DashboardOutlined, ACK_LIST: InboxOutlined, ALARM_LIST: WarningOutlined, TEST: ExperimentOutlined,
  SBRM_USER: TeamOutlined, SBRM_FACTORY: HomeOutlined, SBRM_EQP: ToolOutlined,
  AVMA003: ApartmentOutlined, AVMA004: LinkOutlined, AVMA007: ApartmentOutlined,
  AVMA009: BellOutlined, AVPA004: FileSearchOutlined, AVPA007: HistoryOutlined,
}
// Group only links supplied by the backend, so the navigation retains its visibility rules.
const links = computed(() => {
  const result = []
  function visit(nodes) {
    for (const node of nodes) {
      if (node.path) {
        const path = node.path.replace(/^#/, '')
        const code = path.split('/').pop()
        const group = groups.find(group => group.codes.includes(code)) || groups.at(-1)
        result.push({ ...node, path, code, group })
      }
      visit(node.children || [])
    }
  }
  visit(state.nav)
  return result
})
const selectedKeys = computed(() => [route.path === '/home' ? '/page/AVPA013' : route.path])
function menuItem(node) {
  return {
    key: node.path,
    icon: () => h(icons[node.code] || SettingOutlined),
    title: t(node.name),
    label: h(RouterLink, { to: node.path, 'aria-current': selectedKeys.value.includes(node.path) ? 'page' : undefined }, () => t(node.name)),
  }
}
const query = computed(() => search.value.trim().toLowerCase())
const matching = computed(() => links.value.filter(node =>
  `${node.id} ${node.code} ${node.name} ${t(node.name)} ${t(node.group.label)}`.toLowerCase().includes(query.value)))
const items = computed(() => query.value ? matching.value.map(menuItem) : groups.map(group => ({
  key: group.key, label: t(group.label), icon: () => h(group.icon),
  children: links.value.filter(node => node.group.key === group.key).map(menuItem),
})).filter(group => group.children.length))
watch([() => route.path, links, collapsed], () => {
  const active = links.value.find(node => selectedKeys.value.includes(node.path))
  if (active && !openKeys.value.includes(active.group.key)) openKeys.value = [...openKeys.value, active.group.key]
}, { immediate: true })
function navigate({ key, domEvent }) {
  // Keep modified link clicks available for opening a feature in a new tab.
  if (domEvent?.metaKey || domEvent?.ctrlKey || domEvent?.shiftKey || domEvent?.altKey || domEvent?.button > 0) return
  if (String(key).startsWith('/') && route.path !== key) router.push(key)
}
function toggle() {
  collapsed.value = !collapsed.value
  search.value = ''
  try { localStorage.setItem(storageKey, String(collapsed.value)) } catch { /* Browsing with storage disabled still supports navigation. */ }
}
function breakpoint(broken) { collapsed.value = broken || savedPreference() }
async function beginSearch() {
  collapsed.value = false
  await nextTick()
  searchInput.value?.focus()
}
const emptyImage = AEmpty.PRESENTED_IMAGE_SIMPLE
</script>
<template>
  <a-layout-sider class="sidebar" :class="{ 'sidebar-collapsed': collapsed }" :width="248" :collapsed-width="72"
    :collapsed="collapsed" :trigger="null" collapsible breakpoint="lg" @breakpoint="breakpoint">
    <RouterLink to="/home" class="sidebar-brand" :aria-label="t('首页')">
      <span class="sidebar-logo">A<span v-if="!collapsed">MS</span></span>
      <span v-if="!collapsed" class="sidebar-brand-copy"><strong>{{ t('警报管理系统') }}</strong><small>ALARM MANAGEMENT</small></span>
    </RouterLink>
    <div v-if="!collapsed" class="sidebar-environment"><span/>{{ t('本地演示环境') }}</div>
    <div class="sidebar-search">
      <a-tooltip v-if="collapsed" :title="t('搜索功能')" placement="right">
        <a-button class="sidebar-search-trigger" type="text" :aria-label="t('搜索功能')" @click="beginSearch"><SearchOutlined/></a-button>
      </a-tooltip>
      <a-input v-else ref="searchInput" v-model:value="search" class="nav-search" :placeholder="t('搜索功能')"
        :aria-label="t('搜索功能')" allow-clear @keydown.esc="search = ''">
        <template #prefix><SearchOutlined/></template>
      </a-input>
      <div v-if="query && !collapsed" class="sidebar-search-count">{{ matching.length }} {{ t('项功能') }}</div>
    </div>
    <nav class="sidebar-navigation" :aria-label="t('功能导航')">
      <a-menu v-if="items.length" :key="query ? 'search' : collapsed ? 'collapsed' : 'groups'" mode="inline" theme="dark" :items="items"
        :selected-keys="selectedKeys" :open-keys="query || collapsed ? undefined : openKeys"
        force-sub-menu-render :inline-indent="16" @click="navigate" @open-change="keys => { if (!query && !collapsed) openKeys = keys }"/>
      <a-empty v-else :image="emptyImage" :description="t('未找到匹配功能')" class="sidebar-empty"/>
    </nav>
    <div class="sidebar-bottom">
      <span v-if="!collapsed" class="sidebar-version">AMS <small>v1.0.0</small></span>
      <a-tooltip :title="collapsed ? t('展开导航') : t('收起导航')" placement="right">
        <a-button type="text" class="sidebar-toggle" :aria-label="collapsed ? t('展开导航') : t('收起导航')"
          :aria-expanded="!collapsed" @click="toggle">
          <MenuUnfoldOutlined v-if="collapsed"/><MenuFoldOutlined v-else/>
        </a-button>
      </a-tooltip>
    </div>
  </a-layout-sider>
</template>
