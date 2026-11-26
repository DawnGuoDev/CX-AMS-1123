<script setup>
/**
 * AMS sidebar: Layout.Sider + Menu, grouped navigation, icon rail at 72px, search.
 * Takes links through props (production derives them from the backend); emits `navigate`
 * instead of using vue-router, so the preview has no route/API dependency.
 */
import { computed, h, nextTick, ref, watch } from 'vue'
import {
  ApartmentOutlined, BellOutlined, DashboardOutlined, DatabaseOutlined, ExperimentOutlined,
  FileSearchOutlined, HistoryOutlined, InboxOutlined, HomeOutlined, LinkOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, SearchOutlined, SettingOutlined, TeamOutlined, ThunderboltOutlined, ToolOutlined,
} from '@ant-design/icons-vue'
import { Empty as AEmpty, Input as AInput, LayoutSider as ALayoutSider, Menu as AMenu, Tooltip as ATooltip, Button as AButton } from 'ant-design-vue'

const props = defineProps({
  links: { type: Array, default: () => [] },
  activePath: { type: String, default: '' },
  startCollapsed: Boolean,
  preferenceKey: { type: String, default: 'ams.design-system.sidebar.collapsed' },
})
const emit = defineEmits(['navigate'])
const groups = [
  { key: 'operations', label: '警报作业', icon: ThunderboltOutlined, codes: ['AVPA013', 'ACK_LIST', 'TEST'] },
  { key: 'basics', label: '基础资料', icon: DatabaseOutlined, codes: ['SBRM_USER', 'SBRM_FACTORY', 'SBRM_EQP', 'AVMA003', 'AVMA004'] },
  { key: 'notifications', label: '通知配置', icon: BellOutlined, codes: ['AVMA007', 'AVMA009'] },
  { key: 'reports', label: '查询报表', icon: FileSearchOutlined, codes: ['AVPA004', 'AVPA007'] },
  { key: 'other', label: '其他功能', icon: SettingOutlined, codes: [] },
]
const icons = {
  AVPA013: DashboardOutlined, ACK_LIST: InboxOutlined, TEST: ExperimentOutlined, SBRM_USER: TeamOutlined,
  SBRM_FACTORY: HomeOutlined, SBRM_EQP: ToolOutlined, AVMA003: ApartmentOutlined, AVMA004: LinkOutlined,
  AVMA007: ApartmentOutlined, AVMA009: BellOutlined, AVPA004: FileSearchOutlined, AVPA007: HistoryOutlined,
}
function savedPreference() {
  try {
    const stored = localStorage.getItem(props.preferenceKey)
    return stored === null ? props.startCollapsed : stored === 'true'
  } catch { return props.startCollapsed }
}
const collapsed = ref(savedPreference()), search = ref(''), searchInput = ref(null)
const autoCollapse = ref(false)
const openKeys = ref(['operations', 'basics'])
const items = computed(() => props.links.map(link => {
  const code = String(link.path).split('/').pop()
  const group = groups.find(group => group.codes.includes(code)) || groups.at(-1)
  return { ...link, path: String(link.path).replace(/^#/, ''), code, group }
}))
const selectedKeys = computed(() => [props.activePath || items.value[0]?.path].filter(Boolean))
const menuItem = node => ({
  key: node.path, icon: () => h(icons[node.code] || SettingOutlined), title: node.name,
  label: h('a', { href: `#${node.path}`, 'aria-current': selectedKeys.value.includes(node.path) ? 'page' : undefined, onClick: event => { event.preventDefault(); navigate({ key: node.path }) } }, node.name),
})
const query = computed(() => search.value.trim().toLowerCase())
const matching = computed(() => items.value.filter(node => `${node.id} ${node.code} ${node.name} ${node.group.label}`.toLowerCase().includes(query.value)))
const menuItems = computed(() => query.value ? matching.value.map(menuItem) : groups.map(group => ({
  key: group.key, label: group.label, icon: () => h(group.icon),
  children: items.value.filter(node => node.group.key === group.key).map(menuItem),
})).filter(group => group.children.length))
watch([() => props.activePath, items], () => {
  const active = items.value.find(node => selectedKeys.value.includes(node.path))
  if (active && !openKeys.value.includes(active.group.key)) openKeys.value = [...openKeys.value, active.group.key]
}, { immediate: true })
function navigate({ key }) { if (String(key).startsWith('/')) emit('navigate', key) }
function toggle() {
  collapsed.value = !collapsed.value
  autoCollapse.value = false
  search.value = ''
  try { localStorage.setItem(props.preferenceKey, String(collapsed.value)) } catch { /* storage may be disabled */ }
}
function breakpoint(broken) { autoCollapse.value = broken; collapsed.value = broken || savedPreference() }
async function beginSearch() { collapsed.value = false; await nextTick(); searchInput.value?.focus() }
const emptyImage = AEmpty.PRESENTED_IMAGE_SIMPLE
defineExpose({ collapsed })
</script>
<template>
  <a-layout-sider class="sidebar" :class="{ 'sidebar-collapsed': collapsed }" :width="248" :collapsed-width="72"
    :collapsed="collapsed" :trigger="null" collapsible breakpoint="lg" @breakpoint="breakpoint">
    <a class="sidebar-brand" href="#/home" aria-label="首页" @click.prevent="emit('navigate', '/home')">
      <span class="sidebar-logo">A<span v-if="!collapsed">MS</span></span>
      <span v-if="!collapsed" class="sidebar-brand-copy"><strong>警报管理系统</strong><small>ALARM MANAGEMENT</small></span>
    </a>
    <div v-if="!collapsed" class="sidebar-environment"><span/>本地演示环境</div>
    <div class="sidebar-search">
      <a-tooltip v-if="collapsed" title="搜索功能" placement="right">
        <a-button class="sidebar-search-trigger" type="text" aria-label="搜索功能" @click="beginSearch"><SearchOutlined/></a-button>
      </a-tooltip>
      <a-input v-else ref="searchInput" v-model:value="search" class="nav-search" placeholder="搜索功能"
        aria-label="搜索功能" allow-clear @keydown.esc="search = ''">
        <template #prefix><SearchOutlined/></template>
      </a-input>
      <div v-if="query && !collapsed" class="sidebar-search-count">{{ matching.length }} 项功能</div>
    </div>
    <nav class="sidebar-navigation" aria-label="功能导航">
      <a-menu v-if="menuItems.length" :key="query ? 'search' : collapsed ? 'collapsed' : 'groups'" mode="inline" theme="dark" :items="menuItems"
        :selected-keys="selectedKeys" :open-keys="query || collapsed ? undefined : openKeys"
        force-sub-menu-render :inline-indent="16" @click="navigate" @open-change="keys => { if (!query && !collapsed) openKeys = keys }"/>
      <a-empty v-else :image="emptyImage" description="未找到匹配功能" class="sidebar-empty"/>
    </nav>
    <div class="sidebar-bottom">
      <span v-if="!collapsed" class="sidebar-version">AMS <small>v1.0.0</small></span>
      <a-tooltip :title="collapsed ? '展开导航' : '收起导航'" placement="right">
        <a-button type="text" class="sidebar-toggle" :aria-label="collapsed ? '展开导航' : '收起导航'"
          :aria-expanded="!collapsed" @click="toggle">
          <MenuUnfoldOutlined v-if="collapsed"/><MenuFoldOutlined v-else/>
        </a-button>
      </a-tooltip>
    </div>
  </a-layout-sider>
</template>
