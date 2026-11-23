<script setup>
import { computed,onMounted,ref } from 'vue'
import { state,api,act,t,notify,alarmColumns,openAlarm,bootstrap } from '../state'
import { configurations } from '../configuration'
import MasterPage from './MasterPage.vue'
import OperationsPage from './OperationsPage.vue'
import ReportPage from './ReportPage.vue'
import ConfigurationPage from './ConfigurationPage.vue'
import EventTreePage from './EventTreePage.vue'
import DataGrid from '../components/DataGrid.vue'
import StructureEditor from '../components/StructureEditor.vue'
import RecordDialog from '../components/RecordDialog.vue'
const props=defineProps({code:String,alarmKey:String})
const title=computed(()=>state.meta.pageTitles?.[props.code]||state.meta.masters?.[props.code]?.title||state.meta.mappings?.[props.code]?.title||state.meta.masterDetails?.[props.code]?.title||({INBOX:'通知收件箱',ACK:'警报确认页'})[props.code]||props.code)
const master=computed(()=>state.meta.masters?.[props.code]||state.meta.mappings?.[props.code]||state.meta.masterDetails?.[props.code])
const data=ref({}),selected=ref([]),confirm=ref(''),filters=ref({active:'',alarmCode:'',factoryKey:'',subsysKey:'',eqpKey:'',groupKey:''})
async function load(){
  if(props.code==='HOME')data.value=await api('/dashboard')
  if(props.code==='AVPA015')data.value=await api('/devices')
  if(props.code==='MCMS038')data.value=await api('/functions')
  if(props.code==='CVMA014')data.value=await api('/batch-alarm/query?'+new URLSearchParams(filters.value))
  if(props.code==='ACK')await openAlarm(props.alarmKey)
}
async function saveMenu(){await api('/functions',{nodes:data.value.rows});await bootstrap();notify('储存成功')}
async function batch(){await api('/batch-alarm/change',{keys:selected.value.map(r=>r.ALARM_INFO_KEY),active:confirm.value});confirm.value='';await load();notify('储存成功')}
onMounted(()=>act(load))
</script>
<template>
  <div class="page-heading"><div><div class="eyebrow">{{ code==='HOME'?'OPERATIONS OVERVIEW':code }}</div><h1>{{ t(title) }}</h1></div><span class="muted">{{ new Date().toLocaleDateString() }}</span></div>
  <template v-if="code==='HOME' && data.kpi">
    <div class="kpis"><RouterLink v-for="card in [{key:'today',label:'今日警报',page:'AVPA004'},{key:'process',label:'处理中',page:'AVPA006'},{key:'pending',label:'待我确认',page:'AVPA003'},{key:'invalidToday',label:'今日无效警报',page:'AVPA005'}]" :key="card.key" :to="`/page/${card.page}`" class="kpi"><span>{{ t(card.label) }}</span><strong>{{ data.kpi[card.key] }}</strong><small>↗ {{ t('查看详情') }}</small></RouterLink></div>
    <div class="dashboard-grid"><section class="panel"><div class="section-heading"><h3>{{ t('近 12 小时警报趋势') }}</h3><span class="tag">LIVE</span></div><div class="bar-chart"><div v-for="(point,index) in data.hourly" :key="index" class="bar-slot"><span>{{ point.count }}</span><div :style="{height:`${Math.max(4,point.count / Math.max(1,...data.hourly.map(p=>p.count))*140)}px`}"/><small>{{ point.hour }}:00</small></div></div></section>
      <section class="panel"><h3>{{ t('快捷作业') }}</h3><div class="quick-actions"><RouterLink to="/page/AVPA009">＋ {{ t('警报补登作业') }} <span>→</span></RouterLink><RouterLink to="/page/AVPA003">✓ {{ t('警报确认回报作业') }} <span>→</span></RouterLink><RouterLink to="/page/AVMA009">⚙ {{ t('警报通知设定') }} <span>→</span></RouterLink><RouterLink to="/page/AVPA008">◉ {{ t('系统装置状态查询') }} <span>{{ data.deviceSummary.ok }}/{{ data.deviceSummary.total }}</span></RouterLink></div></section></div>
    <section class="panel"><div class="section-heading"><h3>{{ t('最新警报') }}</h3><button @click="act(load)">{{ t('重新整理') }}</button></div><DataGrid :rows="data.recent" :columns="alarmColumns.slice(0,7)" @open="openAlarm"/></section>
  </template>
  <MasterPage v-else-if="master" :code="code"/>
  <OperationsPage v-else-if="['AVPA002','AVPA009','AVPA003','AVPA006','INBOX'].includes(code)" :code="code"/>
  <ReportPage v-else-if="['AVPA004','AVPA005','AVPA007','AVPA008','AVPA013'].includes(code)" :code="code"/>
  <ConfigurationPage v-else-if="configurations[code]" :code="code"/>
  <EventTreePage v-else-if="code==='AVMA008'"/>
  <template v-else-if="code==='AVPA015'"><div class="toolbar"><button class="primary" @click="act(async()=>{await api('/devices/save',{items:data.rows});notify('储存成功');await load()})">{{ t('储存') }}</button><button @click="act(load)">{{ t('重新整理') }}</button></div><DataGrid :rows="data.rows||[]" :columns="['SERVER_ID','AGENT_ID','DEVICE_ID','DEVICE_STATUS','ENABLE','RECEIVED_COUNT','SUCCESSFUL_COUNT','FAIL_COUNT'].map(field=>({field,label:field}))"><template #actions="{row}"><label class="check"><input type="checkbox" v-model="row.ENABLE" true-value="Y" false-value="N">{{ t('启用') }}</label></template></DataGrid></template>
  <template v-else-if="code==='MCMS038'"><p class="description">保存后导航即时更新；支持父菜单、显示状态、路径与 Action 定义。</p><div class="toolbar"><button class="primary" @click="act(saveMenu)">{{ t('储存') }}</button><button @click="act(load)">{{ t('重新整理') }}</button></div><StructureEditor v-if="data.rows" v-model="data.rows" :template="{FUNCTION_ID:'',FUNCTION_NAME:'',PARENT_KEY:'',PATH:'',FUNC_TYPE:'PAGE',SORT:0,VISIBLE:'Y',ACTIVE:'Y'}"/></template>
  <template v-else-if="code==='CVMA014'"><div class="panel query-fields"><label>{{ t('启用状态') }}<select v-model="filters.active"><option value="">{{ t('全部') }}</option><option>Y</option><option>N</option></select></label><label>{{ t('警报代码') }}<input v-model="filters.alarmCode"></label><label v-for="[name,label,set] in [['factoryKey','厂别','factory'],['subsysKey','子系统','subsystem'],['eqpKey','机台','eqp'],['groupKey','机台群组','eqpGroup']]" :key="name">{{ t(label) }}<select v-model="filters[name]"><option value="">{{ t('全部') }}</option><option v-for="o in state.options[set]" :key="o.value" :value="o.value">{{ o.label }}</option></select></label></div><div class="toolbar"><button class="primary" @click="act(load)">{{ t('查询') }}</button><button :disabled="!selected.length" @click="confirm='N'">{{ t('隐藏') }}</button><button :disabled="!selected.length" @click="confirm='Y'">{{ t('取消隐藏') }}</button></div><DataGrid :rows="data.rows||[]" :columns="state.meta.masters.AVMA009.fields.filter(f=>f.grid!==false)" selectable @select="selected=$event"/></template>
  <template v-else-if="code==='ACK'"><button class="primary" @click="openAlarm(alarmKey)">{{ t('打开确认页') }}</button></template>
  <RecordDialog v-if="confirm" title="确认" @close="confirm=''"><p>确认批次{{ confirm==='Y'?'取消隐藏':'隐藏' }} {{ selected.length }} 笔警报设定？</p><button class="primary" @click="act(batch)">{{ t('确定') }}</button></RecordDialog>
</template>
