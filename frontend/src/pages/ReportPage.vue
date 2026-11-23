<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { state, api, act, t, download, openAlarm } from '../state'
import DataGrid from '../components/DataGrid.vue'
import RecordDialog from '../components/RecordDialog.vue'
const props=defineProps({code:String})
const data=ref({rows:[],columns:[]}), definition=ref({CONDITIONS:[]}), conditions=ref({}), drill=ref(null), device=ref(null)
let timer
const isSummary=computed(() => props.code==='AVPA013')
async function load() {
  if(isSummary.value) {
    data.value=await api(drill.value ? `/summary/detail?factory=${drill.value.FACTORY_KEY}&subsys=${drill.value.SUB_SYS_KEY}` : '/summary/master')
    data.value.columns=(drill.value ? [['EQP_ID','机台代码'],['EQP_NAME','机台名称'],['ALARM_COUNT','警报数量']] : [['FACTORY_ID','厂别代码'],['FACTORY_NAME','厂别名称'],['SUB_SYS_ID','子系统代码'],['SUB_SYS_NAME','子系统名称'],['ALARM_COUNT','警报数量']]).map(([field,label])=>({field,label}))
  } else data.value=await api(`/reports/${props.code}/query`,{conditions:conditions.value})
}
async function open(row) {
  if(isSummary.value && !drill.value) { drill.value=row; await act(load) }
  else if(props.code==='AVPA008') device.value=row
  else if(row.ALARM_KEY) await openAlarm(row)
}
function resetConditions() {
  conditions.value={}
  for(const c of definition.value.CONDITIONS) {
    if(c.type==='dateRange') {
      const today=new Date(), from=new Date(Date.now()-(c.defaultDays||7)*86400000)
      conditions.value[c.field]={from:from.toISOString().slice(0,10),to:today.toISOString().slice(0,10),enabled:c.enabled !== false}
    } else conditions.value[c.field]=''
  }
}
onMounted(() => act(async () => {
  definition.value=(await api(`/report-defs/${props.code}`)).row
  resetConditions()
  await load()
  if(isSummary.value || props.code==='AVPA008') timer=setInterval(() => { if(!document.hidden) act(load) },10000)
}))
onUnmounted(() => clearInterval(timer))
</script>
<template>
  <form class="panel query-form" @submit.prevent="act(load)" v-if="definition.CONDITIONS.length">
    <div class="query-fields"><label v-for="c in definition.CONDITIONS" :key="c.field"><span>{{ t(c.label) }}</span>
      <div v-if="c.type==='dateRange' && conditions[c.field]" class="date-range"><input type="checkbox" v-model="conditions[c.field].enabled"><input type="date" v-model="conditions[c.field].from"><span>—</span><input type="date" v-model="conditions[c.field].to"></div>
      <select v-else-if="c.type==='select'" v-model="conditions[c.field]"><option value="">{{ t('全部') }}</option><option v-for="o in state.options[c.optionSet] || []" :key="o.value" :value="o.value">{{ o.label }}</option></select>
      <input v-else v-model="conditions[c.field]">
    </label></div><div class="toolbar"><button class="primary">{{ t('查询') }}</button><button type="button" @click="resetConditions">{{ t('清除') }}</button></div>
  </form>
  <div class="toolbar"><button v-if="drill" @click="drill=null;act(load)">{{ t('回上层') }}</button><button @click="act(load)">{{ t('重新整理') }}</button><span v-if="isSummary" class="muted">{{ t('每 10 秒自动更新') }}</span><span class="spacer"/><button @click="act(async()=>download(await api(`/reports/${code}/export`,{conditions})))">{{ t('汇出') }}</button></div>
  <DataGrid :rows="data.rows" :columns="data.columns" @open="open"/>
  <RecordDialog v-if="device" title="系统装置状态查询" wide @close="device=null"><h3>{{ device.SERVER_ID }} / {{ device.AGENT_ID }}</h3><DataGrid :rows="device.DEVICES" :columns="['DEVICE_ID','DEVICE_STATUS','ENABLE','RECEIVED_COUNT','SUCCESSFUL_COUNT','FAIL_COUNT','TRX_DATE'].map(field=>({field,label:field}))"/></RecordDialog>
</template>
