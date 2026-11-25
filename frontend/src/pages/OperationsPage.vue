<script setup>
import { Button as AButton, Input as AInput, Textarea as ATextarea, Select as ASelect, SelectOption as ASelectOption, Modal as AModal } from 'ant-design-vue'
import { onMounted,onUnmounted,ref,watch } from 'vue'
import { state,api,act,t,notify,alarmColumns,openAlarm } from '../state'
import DataGrid from '../components/DataGrid.vue'
import DeviceSimulator from '../components/DeviceSimulator.vue'
const props=defineProps({code:String})
const form=ref({factoryKey:'',subsysKey:'',eqpKey:'',alarmCode:'',title:'',content:''})
const options=ref({}),rows=ref([])
const tab=ref('manual'),simBusy=ref(false)
// 批量确认回报（ACK_LIST）
const ACK_COMMENT_MAX=500
const selectedKeys=ref(new Set())
const batchOpen=ref(false),batchComment=ref(''),batchBusy=ref(false)
let version=0,timer
async function loadOptions(){
  const current=++version
  const result=await api('/alarms/test/options?'+new URLSearchParams(form.value))
  if(current===version)options.value=result
}
watch(()=>form.value.factoryKey,()=>{form.value.subsysKey='';form.value.alarmCode='';act(loadOptions)})
watch(()=>[form.value.subsysKey,form.value.eqpKey],()=>{form.value.alarmCode='';act(loadOptions)})
async function load(){
  if(props.code==='TEST'){await loadOptions();return}
  const latest=(await api('/alarms/pending')).rows
  // 轮询/筛选刷新后，仅保留仍可确认的选择，避免对失效选择静默成功。
  const valid=new Set(latest.map(r=>r.ALARM_KEY))
  selectedKeys.value=new Set([...selectedKeys.value].filter(k=>valid.has(k)))
  rows.value=latest
}
function onSelect(selectedRows){ selectedKeys.value=new Set(selectedRows.map(r=>String(r.ALARM_KEY))) }
function openBatch(){ batchComment.value='';batchOpen.value=true }
function cancelBatch(){ if(!batchBusy.value)batchOpen.value=false }
async function submitBatch(){
  if(batchBusy.value||selectedKeys.value.size===0)return
  if(batchComment.value.length>ACK_COMMENT_MAX){state.error=`回应备注长度不可超过 ${ACK_COMMENT_MAX} 字符`;return}
  batchBusy.value=true
  try {
    const result=await api('/alarms/ack',{keys:[...selectedKeys.value],cmt:batchComment.value})
    const failed=result.items.filter(i=>!i.ok)
    notify(failed.length?`确认完成：成功 ${result.successCount} 笔，失败 ${result.failCount} 笔`:`警报确认成功：共 ${result.successCount} 笔`)
    if(failed.length){
      state.error='失败明细：'+failed.map(i=>`${i.ALARM_KEY}（${i.message}）`).join('；')
    } else state.error=''
    batchOpen.value=false
    await act(load)
  } catch(error) {
    state.error=error.message
  } finally { batchBusy.value=false }
}
async function submit(){
  await act(async()=>{
    const result=await api('/alarms/test',form.value)
    notify(result.logOnly?'已记录：子系统 BYPASS，不发送邮件':'告警已触发，邮件等待 SMTP 发送')
    await openAlarm(result.alarm)
  })
}
onMounted(()=>{act(load);if(props.code==='ACK_LIST')timer=setInterval(()=>{if(!document.hidden&&!batchOpen.value)act(load)},10000)})
onUnmounted(()=>clearInterval(timer))
</script>
<template>
  <section v-if="code==='TEST'" class="panel send-form">
    <div class="tabs"><a-button :class="{active:tab==='manual'}" @click="tab='manual'" type="default" html-type="button">手动触发</a-button><a-button :class="{active:tab==='device'}" @click="tab='device'" type="default" html-type="button">设备模拟</a-button></div>
    <p class="description">模拟上游触发已配置的告警。通知人员、ACK 人数和升级策略由“事件通知管理”中的配置决定。</p>
    <p v-if="!state.smtpConfigured" class="warning">SMTP 尚未配置。触发后邮件会记录为发送失败，请先配置 SMTP 服务。</p>
    <div class="fields">
      <label v-for="[field,label,set] in [['factoryKey','厂别','factories'],['subsysKey','子系统','subsystems'],['eqpKey','机台','eqps'],['alarmCode','警报代码','alarmCodes']]" :key="field"><span>{{ label }} *</span><a-select :aria-label="label" v-model:value="form[field]" :disabled="simBusy" required><a-select-option value="">请选择</a-select-option><a-select-option v-for="o in options[set]" :key="o.value" :value="o.value">{{ o.label }}</a-select-option></a-select></label>
    </div>
    <DeviceSimulator v-if="tab==='device'" :form="form" @busy="simBusy=$event"/>
    <form v-else @submit.prevent="submit">
    <label class="comment"><span>警报标题</span><a-input v-model:value="form.title" required/></label>
    <label class="comment"><span>详细内容</span><a-textarea v-model:value="form.content" rows="5"/></label>
    <div class="form-actions"><a-button class="primary" :disabled="state.busy>0 || !form.factoryKey || !form.subsysKey || !form.eqpKey || !form.alarmCode" type="primary" html-type="submit">触发测试告警</a-button></div>
    </form>
  </section>
  <template v-else>
    <div class="toolbar">
      <a-button @click="act(load)" type="default" html-type="button">{{ t('重新整理') }}</a-button>
      <a-button type="primary" html-type="button" :disabled="selectedKeys.size===0 || state.busy>0" @click="openBatch">批量确认回报</a-button>
      <span class="muted">已选 {{ selectedKeys.size }} 笔；打开详情可逐笔确认；每 10 秒更新。</span>
    </div>
    <DataGrid :rows="rows" :columns="alarmColumns" selectable row-key="ALARM_KEY" :clear-selection-on-refresh="false" @select="onSelect" @open="openAlarm"/>
    <a-modal :open="batchOpen" title="批量确认回报" :confirm-loading="batchBusy" :ok-text="batchBusy?'确认中…':'确认回报'" cancel-text="取消"
      :ok-button-props="{disabled:selectedKeys.size===0}" @ok="submitBatch" @cancel="cancelBatch">
      <p>将对已选的 <strong>{{ selectedKeys.size }}</strong> 笔警报执行确认回报，对每笔套用相同的服务端校验；提交期间不可重复送出。</p>
      <label class="comment batch-comment"><span>{{ t('回应备注') }}（选填，最多 {{ ACK_COMMENT_MAX }} 字符）</span>
        <a-textarea v-model:value="batchComment" :rows="3" :maxlength="ACK_COMMENT_MAX" show-count :disabled="batchBusy"/>
      </label>
    </a-modal>
  </template>
</template>
