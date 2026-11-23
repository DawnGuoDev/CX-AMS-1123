<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { state, api, act, t, notify, alarmColumns, openAlarm } from '../state'
import DataGrid from '../components/DataGrid.vue'
import RecordDialog from '../components/RecordDialog.vue'
const props = defineProps({ code: String })
const manual = computed(() => props.code === 'AVPA002'), send = computed(() => ['AVPA002','AVPA009'].includes(props.code))
const form = ref({ factoryKey:'',subsysKey:'',eqpKey:'',alarmCode:'',userKeys:[],channels:['Email'],title:'',content:'',requiredAck:'1' })
const options=ref({}), rows=ref([]), subjects=ref([]), selected=ref([]), comment=ref(''), confirm=ref(false)
let optionsVersion=0
async function loadOptions() {
  const version=++optionsVersion
  const data=await api('/alarms/backfill/options?'+new URLSearchParams({factoryKey:form.value.factoryKey,subsysKey:form.value.subsysKey,eqpKey:form.value.eqpKey}))
  if (version===optionsVersion) options.value=data
}
watch(() => form.value.factoryKey, () => { form.value.subsysKey=''; form.value.alarmCode=''; act(loadOptions) })
watch(() => [form.value.subsysKey,form.value.eqpKey], () => { form.value.alarmCode=''; act(loadOptions) })
async function load() {
  if (send.value) { await loadOptions(); subjects.value=(await api('/alarm-subjects')).rows }
  else rows.value=(await api(props.code === 'INBOX' ? '/inbox' : props.code === 'AVPA003' ? '/alarms/pending' : '/alarms/process')).rows
}
async function submit() {
  await act(async () => {
    const result=await api(manual.value?'/alarms/manual':'/alarms/backfill',form.value)
    notify(result.logOnly?'警报已记录（BYPASS）':result.matchedBy==='group-fallback'?'警报已发送（机台群组回退匹配）':'警报已发送')
    await openAlarm(result.alarm)
  })
}
async function batch() {
  await act(async () => {
    let success=0; const errors=[]
    for (const row of selected.value) {
      try { await api(`/alarms/${row.ALARM_KEY}/${props.code==='AVPA003'?'ack':'terminate'}`,{cmt:comment.value}); success++ }
      catch(e) { errors.push(`${row.ALARM_ID}: ${e.message}`) }
    }
    confirm.value=false; await load(); notify(`已处理 ${success} 笔`)
    if(errors.length) state.error=errors.join('；')
  })
}
onMounted(() => act(load))
</script>
<template>
  <form v-if="send" class="panel send-form" @submit.prevent="submit">
    <div class="section-label">01 / {{ t('基本资讯') }}</div>
    <div class="fields">
      <label class="required"><span>{{ t('厂别') }} *</span><select v-model="form.factoryKey" required><option value="">{{ t('请选择') }}</option><option v-for="o in options.factories" :key="o.value" :value="o.value">{{ o.label }}</option></select></label>
      <label class="required"><span>{{ t('子系统') }} *</span><select v-model="form.subsysKey" required><option value="">{{ t('请选择') }}</option><option v-for="o in options.subsystems" :key="o.value" :value="o.value">{{ o.label }}</option></select></label>
      <template v-if="!manual"><label class="required"><span>{{ t('机台') }} *</span><select v-model="form.eqpKey" required><option value="">{{ t('请选择') }}</option><option v-for="o in options.eqps" :key="o.value" :value="o.value">{{ o.label }}</option></select></label>
      <label class="required"><span>{{ t('警报代码') }} *</span><select v-model="form.alarmCode" required><option value="">{{ t('请选择') }}</option><option v-for="o in options.alarmCodes" :key="o.value" :value="o.value">{{ o.label }}</option></select></label></template>
    </div>
    <template v-if="manual"><div class="section-label">02 / {{ t('通知人员') }}</div><div class="transfer-list"><label v-for="u in options.users" :key="u.value" class="check"><input type="checkbox" v-model="form.userKeys" :value="u.value">{{ u.label }}</label></div>
      <div class="toolbar"><label class="check" v-for="o in options.channels" :key="o.value"><input type="checkbox" v-model="form.channels" :value="o.value">{{ o.label }}</label><label>{{ t('需要回应的人数') }} <select v-model="form.requiredAck"><option value="1">1</option><option value="*">* {{ t('全员') }}</option></select></label></div></template>
    <div class="section-label">{{ manual ? '03':'02' }} / {{ t('警报内容') }}</div>
    <label class="comment"><span>{{ t('警报标题') }}</span><input v-model="form.title" list="subjects" :placeholder="t('请输入警报标题')"><datalist id="subjects"><option v-for="s in subjects" :key="s.SUBJECT_KEY" :value="s.SUBJECT"/></datalist></label>
    <label class="comment"><span>{{ t('详细内容') }}</span><textarea v-model="form.content" rows="6"/></label>
    <div class="form-actions"><button type="button" @click="form.title='';form.content=''">{{ t('清除') }}</button><button class="primary" :disabled="state.busy > 0">{{ t('发送') }}</button></div>
  </form>
  <template v-else>
    <div class="toolbar"><button @click="act(load)">{{ t('重新整理') }}</button><template v-if="code !== 'INBOX'"><input v-model="comment" :placeholder="t('回应备注')"><button class="primary" :disabled="!selected.length" @click="confirm=true">{{ t(code==='AVPA003'?'批量确认':'批量中断') }} ({{ selected.length }})</button></template></div>
    <DataGrid :rows="rows" :columns="code==='INBOX'?[...alarmColumns.slice(0,3),{field:'CHANNEL',label:'发送方式'},{field:'RESULT',label:'状态'},{field:'SEND_DT',label:'发送时间'}]:alarmColumns" :selectable="code !== 'INBOX'" @select="selected=$event" @open="openAlarm"/>
  </template>
  <RecordDialog v-if="confirm" title="确认" @close="confirm=false"><p>{{ t(code==='AVPA003'?'确认所选警报？':'确认强制中断所选警报？') }}（{{ selected.length }}）</p><div class="form-actions"><button @click="confirm=false">{{ t('取消') }}</button><button class="primary" @click="batch" :disabled="state.busy>0">{{ t('确定') }}</button></div></RecordDialog>
</template>
