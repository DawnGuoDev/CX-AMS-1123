<script setup>
// Preview-only landing page combining real DataGrid/DataGrid state and the AMS KPI layout.
import { computed, onMounted, ref } from 'vue'
import { Button as AButton } from 'ant-design-vue'
import { api, alarmColumns, openAlarm, t } from '../state'
import DataGrid from '../components/DataGrid.vue'
const rows = ref([])
onMounted(async () => { rows.value = [...(await api('/alarms/pending')).rows, ...(await api('/alarms/pending')).rows.slice(0,0)] })
const kpis = computed(() => [
  { label: '处理中警报', value: rows.value.filter(r => r.STATUS === 'Process').length, hint: 'STATUS = Process' },
  { label: '已闭环警报', value: rows.value.filter(r => r.STATUS === 'Completed').length, hint: 'STATUS = Completed' },
  { label: '待确认人数', value: rows.value.reduce((n, r) => n + Math.max(0, (r.LEVEL_REQUIRED || 0) - (r.LEVEL_ACK_COUNT || 0)), 0), hint: '仅当前层级' },
  { label: '厂别', value: new Set(rows.value.map(r => r.FACTORY_ID)).size, hint: '预览资料' },
])
</script>
<template>
  <div class="page-heading"><div><div class="eyebrow">ALARM OVERVIEW</div><h1>{{ t('即时警报汇总') }}</h1></div><span class="muted">本地 Mock 数据 · 不连接后端</span></div>
  <div class="kpis"><div class="kpi" v-for="k in kpis" :key="k.label"><span>{{ k.label }}</span><strong>{{ k.value }}</strong><small>{{ k.hint }}</small></div></div>
  <div class="section-heading"><h3>待处理警报</h3><a-button size="small" @click="$router.push('/page/AVPA013')">查看完整列表</a-button></div>
  <DataGrid :rows="rows" :columns="alarmColumns.slice(0, 8).map(c => ({ ...c, link: c.field === 'ALARM_ID' }))" row-key="ALARM_KEY" @open="openAlarm"/>
</template>
