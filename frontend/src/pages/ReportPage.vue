<script setup>
import { computed,onMounted,onUnmounted,ref } from 'vue'
import { api,act,t,download,openAlarm,clone } from '../state'
import { textOps,dateOps,emptyFilter,toServerConditions } from '../filters'
import DataGrid from '../components/DataGrid.vue'
import RecordDialog from '../components/RecordDialog.vue'
const props=defineProps({code:String})
const data=ref({rows:[],columns:[]}),definition=ref({CONDITIONS:[]}),conditions=ref({}),draft=ref(null),drill=ref(null)
const queried=ref(false),grid=ref(null),countdown=ref(10)
const isSummary=computed(()=>props.code==='AVPA013')
let timer,loading=false
async function load(next=conditions.value){
  if(loading)return
  loading=true
  try{
    const result=await api(`/reports/${props.code}/query`,{
      conditions:toServerConditions(next),factory:drill.value?.FACTORY_KEY,subsys:drill.value?.SUB_SYS_KEY
    })
    data.value=result;conditions.value=clone(next);queried.value=true;countdown.value=10
  }finally{loading=false}
}
function beginQuery(){draft.value=clone(conditions.value)}
function resetDraft(){draft.value=Object.fromEntries(definition.value.CONDITIONS.map(c=>[c.field,emptyFilter(c)]))}
async function applyQuery(){await act(async()=>{await load(draft.value);draft.value=null})}
async function open(row){
  if(isSummary.value&&!drill.value){drill.value=row;await act(()=>load())}
  else if(row.ALARM_KEY)await openAlarm(row)
}
onMounted(()=>act(async()=>{
  definition.value=(await api(`/report-defs/${props.code}`)).row
  data.value.columns=definition.value.COLUMNS
  conditions.value=Object.fromEntries(definition.value.CONDITIONS.map(c=>[c.field,emptyFilter(c)]))
  if(isSummary.value){
    await load()
    timer=setInterval(()=>{if(!document.hidden){countdown.value--;if(countdown.value<=0){countdown.value=10;act(()=>load())}}},1000)
  }
}))
onUnmounted(()=>clearInterval(timer))
</script>
<template>
  <div class="toolbar">
    <button v-if="!isSummary" class="primary" @click="beginQuery">查询</button>
    <button v-if="drill" @click="drill=null;act(()=>load())">{{ t('回上层') }}</button>
    <button :disabled="!queried" @click="act(()=>load())">{{ t('重新整理') }}</button>
    <span v-if="isSummary" class="muted">{{ countdown }} 秒后自动更新</span>
    <span class="spacer"/><button @click="act(async()=>download(await api(`/reports/${code}/export`,{rows:queried?(grid?.filtered||[]):[],factory:drill?.FACTORY_KEY,subsys:drill?.SUB_SYS_KEY})))">{{ t('汇出') }}</button>
  </div>
  <p v-if="!queried" class="panel">请执行查询</p>
  <DataGrid ref="grid" :rows="data.rows" :columns="data.columns" @open="open"/>
  <RecordDialog v-if="draft" title="查询条件" wide @close="draft=null">
    <form @submit.prevent="applyQuery">
      <p class="muted">勾选启用的条件同时生效；日期时间精确到秒。</p>
      <div class="query-fields">
        <label v-for="c in definition.CONDITIONS" :key="c.field">
          <span><input type="checkbox" v-model="draft[c.field].enabled"> {{ t(c.label) }}</span>
          <select v-model="draft[c.field].operator" :disabled="!draft[c.field].enabled"><option v-for="[value,label] in c.type==='date'?dateOps:textOps" :key="value" :value="value">{{label}}</option></select>
          <div v-if="c.type==='date'&&draft[c.field].operator==='between'" class="date-range">
            <input type="datetime-local" step="1" v-model="draft[c.field].from" :disabled="!draft[c.field].enabled"><span>—</span>
            <input type="datetime-local" step="1" v-model="draft[c.field].to" :disabled="!draft[c.field].enabled">
          </div>
          <input v-else :type="c.type==='date'?'datetime-local':'text'" step="1" v-model="draft[c.field].value" :disabled="!draft[c.field].enabled">
        </label>
      </div>
      <div class="form-actions"><button type="button" @click="resetDraft">清除</button><button type="button" @click="draft=null">取消</button><button class="primary">查询</button></div>
    </form>
  </RecordDialog>
</template>
