<script setup>
// Adapted from release pages/Workspace.vue: page resolution by code, trimmed to migrated pages.
import { computed } from 'vue'
import { state, t } from '../state'
import MasterPage from './MasterPage.vue'
import OperationsPage from './OperationsPage.vue'
const props = defineProps({ code: String })
const master = computed(() => state.meta.masters?.[props.code])
const title = computed(() => master.value?.title || state.meta.pageTitles?.[props.code] || ({ ACK_LIST: '待我确认' })[props.code] || '页面未迁入')
</script>
<template>
  <div class="page-heading"><h1>{{ t(title) }}</h1></div>
  <MasterPage v-if="master" :code="code"/>
  <OperationsPage v-else-if="['TEST', 'ACK_LIST'].includes(code)" :code="code"/>
  <div v-else class="panel">
    <h3>{{ t('此页面尚未迁入原型工程') }}</h3>
    <p class="description">当前预览仅迁入即时警报汇总、待我确认、测试告警触发与使用者/厂别/机台主档。页面 <code>{{ code }}</code> 将在具体需求中按需迁入。</p>
  </div>
</template>
