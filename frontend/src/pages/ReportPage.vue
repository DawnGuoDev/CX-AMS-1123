<script setup>
import { computed,onMounted,onUnmounted,ref } from 'vue'
import { api,act,t,download,openAlarm } from '../state'
import DataGrid from '../components/DataGrid.vue'
const props=defineProps({code:String})
const data=ref({rows:[],columns:[]}),definition=ref({CONDITIONS:[]}),conditions=ref({}),drill=ref(null),showFilters=ref(false)
const isSummary=computed(()=>props.code==='AVPA013')
const textOps=[['contains','包含'],['notContains','不包含'],['starts','开头为'],['ends','结尾为'],['eq','等于'],['neq','不等于']]
const dateOps=[['between','介于'],['eq','等于'],['neq','不等于'],['lt','小于'],['lte','小于等于'],['gt','大于'],['gte','大于等于']]
let timer
async function load(){
  if(isSummary.value){
    data.value=await api(drill.value?`/summary/detail?factory=${drill.value.FACTORY_KEY}&subsys=${drill.value.SUB_SYS_KEY}`:'/summary/master')
    data.value.columns=(drill.value?[['EQP_ID','机台代码'],['EQP_NAME','机台名称'],['ALARM_COUNT','警报数量']]:[['FACTORY_ID','厂别代码'],['FACTORY_NAME','厂别名称'],['SUB_SYS_ID','子系统代码'],['SUB_SYS_NAME','子系统名称'],['ALARM_COUNT','警报数量']]).map(([field,label])=>({field,label}))
  }else data.value=await api(`/reports/${props.code}/query`,{conditions:conditions.value})
}
async function open(row){
  if(isSummary.value&&!drill.value){drill.value=row;await act(load)}
  else if(row.ALARM_KEY)await openAlarm(row)
}
function resetConditions(defaults=false){
  conditions.value={}
  for(const c of definition.value.CONDITIONS)conditions.value[c.field]={enabled:defaults&&c.field==='CREATE_DT',type:c.type,operator:c.type==='date'?'between':'contains',value:'',from:defaults?new Date(Date.now()-7*86400000).toISOString().slice(0,10):'',to:defaults?new Date().toISOString().slice(0,10):''}
}
onMounted(()=>act(async()=>{
  definition.value=(await api(`/report-defs/${props.code}`)).row
  resetConditions(true);await load()
  if(isSummary.value)timer=setInterval(()=>{if(!document.hidden)act(load)},10000)
}))
onUnmounted(()=>clearInterval(timer))
</script>
<template>
  <form v-if="definition.CONDITIONS.length" class="panel query-form" @submit.prevent="act(load)">
    <div class="toolbar"><button type="button" @click="showFilters=!showFilters">{{ showFilters?'收起':'展开' }}列筛选条件</button><span class="muted">勾选启用的条件同时生效</span></div>
    <div class="query-fields">
      <label v-for="c in definition.CONDITIONS.filter(c=>showFilters||conditions[c.field]?.enabled)" :key="c.field">
        <span><input type="checkbox" v-model="conditions[c.field].enabled"> {{ t(c.label) }}</span>
        <select v-model="conditions[c.field].operator"><option v-for="[value,label] in c.type==='date'?dateOps:textOps" :key="value" :value="value">{{ label }}</option></select>
        <div v-if="c.type==='date'&&conditions[c.field].operator==='between'" class="date-range"><input type="date" v-model="conditions[c.field].from"><span>—</span><input type="date" v-model="conditions[c.field].to"></div>
        <input v-else :type="c.type==='date'?'date':'text'" v-model="conditions[c.field].value">
      </label>
    </div><div class="toolbar"><button class="primary">{{ t('查询') }}</button><button type="button" @click="resetConditions(false);showFilters=true">{{ t('清除') }}</button></div>
  </form>
  <div class="toolbar"><button v-if="drill" @click="drill=null;act(load)">{{ t('回上层') }}</button><button @click="act(load)">{{ t('重新整理') }}</button><span v-if="isSummary" class="muted">每 10 秒自动更新</span><span class="spacer"/><button @click="act(async()=>download(await api(`/reports/${code}/export`,{conditions,factory:drill?.FACTORY_KEY,subsys:drill?.SUB_SYS_KEY})))">{{ t('汇出') }}</button></div>
  <DataGrid :rows="data.rows" :columns="data.columns" @open="open"/>
</template>
