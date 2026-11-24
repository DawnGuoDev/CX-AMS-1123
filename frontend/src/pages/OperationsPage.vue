<script setup>
import { onMounted,onUnmounted,ref,watch } from 'vue'
import { state,api,act,t,notify,alarmColumns,openAlarm } from '../state'
import DataGrid from '../components/DataGrid.vue'
import DeviceSimulator from '../components/DeviceSimulator.vue'
const props=defineProps({code:String})
const form=ref({factoryKey:'',subsysKey:'',eqpKey:'',alarmCode:'',title:'',content:''})
const options=ref({}),rows=ref([])
const tab=ref('manual'),simBusy=ref(false)
let version=0,timer
async function loadOptions(){
  const current=++version
  const result=await api('/alarms/test/options?'+new URLSearchParams(form.value))
  if(current===version)options.value=result
}
watch(()=>form.value.factoryKey,()=>{form.value.subsysKey='';form.value.alarmCode='';act(loadOptions)})
watch(()=>[form.value.subsysKey,form.value.eqpKey],()=>{form.value.alarmCode='';act(loadOptions)})
async function load(){if(props.code==='TEST')await loadOptions();else rows.value=(await api('/alarms/pending')).rows}
async function submit(){
  await act(async()=>{
    const result=await api('/alarms/test',form.value)
    notify(result.logOnly?'已记录：子系统 BYPASS，不发送邮件':'告警已触发，邮件等待 SMTP 发送')
    await openAlarm(result.alarm)
  })
}
onMounted(()=>{act(load);if(props.code==='ACK_LIST')timer=setInterval(()=>{if(!document.hidden)act(load)},10000)})
onUnmounted(()=>clearInterval(timer))
</script>
<template>
  <section v-if="code==='TEST'" class="panel send-form">
    <div class="tabs"><button :class="{active:tab==='manual'}" @click="tab='manual'">手动触发</button><button :class="{active:tab==='device'}" @click="tab='device'">设备模拟</button></div>
    <p class="description">模拟上游触发已配置的告警。通知人员、ACK 人数和升级策略由“事件通知管理”中的配置决定。</p>
    <p v-if="!state.smtpConfigured" class="warning">SMTP 尚未配置。触发后邮件会记录为发送失败，请先配置 SMTP 服务。</p>
    <div class="fields">
      <label v-for="[field,label,set] in [['factoryKey','厂别','factories'],['subsysKey','子系统','subsystems'],['eqpKey','机台','eqps'],['alarmCode','警报代码','alarmCodes']]" :key="field"><span>{{ label }} *</span><select v-model="form[field]" :disabled="simBusy" required><option value="">请选择</option><option v-for="o in options[set]" :key="o.value" :value="o.value">{{ o.label }}</option></select></label>
    </div>
    <DeviceSimulator v-if="tab==='device'" :form="form" @busy="simBusy=$event"/>
    <form v-else @submit.prevent="submit">
    <label class="comment"><span>警报标题</span><input v-model="form.title" required></label>
    <label class="comment"><span>详细内容</span><textarea v-model="form.content" rows="5"/></label>
    <div class="form-actions"><button class="primary" :disabled="state.busy>0 || !form.factoryKey || !form.subsysKey || !form.eqpKey || !form.alarmCode">触发测试告警</button></div>
    </form>
  </section>
  <template v-else><div class="toolbar"><button @click="act(load)">{{ t('重新整理') }}</button><span class="muted">打开详情后确认；每 10 秒更新。</span></div><DataGrid :rows="rows" :columns="alarmColumns" @open="openAlarm"/></template>
</template>
