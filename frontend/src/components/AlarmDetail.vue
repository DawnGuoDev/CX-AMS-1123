<script setup>
import { Button as AButton, Modal as AModal, Textarea as ATextarea } from 'ant-design-vue'
import { computed, ref,watch } from 'vue'
import { state, api, act, notify, t, openAlarm } from '../state'
import RecordDialog from './RecordDialog.vue'
import DataGrid from './DataGrid.vue'
const emit = defineEmits(['changed'])
const comment = ref(''), tab = ref('MAIN'), recordTab=ref('NOTIFICATIONS')
const terminateOpen = ref(false), terminateCmt = ref(''), terminateError = ref(''), terminating = ref(false)
const TERMINATE_COMMENT_MAX = 500
watch([()=>state.detail?.ALARM_KEY,()=>state.detail?.HISTORY_CONTEXT?.TRX_KEY],()=>{
  comment.value='';tab.value='MAIN';recordTab.value='NOTIFICATIONS'
  terminateOpen.value=false;terminateCmt.value='';terminateError.value='';terminating.value=false
})
const history = computed(()=>Boolean(state.detail?.HISTORY_CONTEXT))
const canTerminate = computed(()=>state.detail?.CAN_TERMINATE === true && state.detail?.STATUS === 'Process' && !history.value)
const terminateHint = computed(()=>{
  if (!state.detail || history.value) return ''
  if (state.detail.STATUS === 'Terminated') return '警报已中断，流程已结束'
  if (state.detail.STATUS !== 'Process') return '仅处理中（Process）的警报可中断'
  if (state.detail.CAN_TERMINATE !== true) return '您没有强制中断权限，请联系具权限人员处理。'
  return ''
})
// The detail dialog is itself a modal; render the confirmation in <body> so it is not clipped.
const terminateContainer = () => document.body
function openTerminate(){terminateCmt.value='';terminateError.value='';terminateOpen.value=true}
function closeTerminate(){terminateOpen.value=false;terminateCmt.value='';terminateError.value=''}
async function terminate(){
  const cmt = terminateCmt.value.trim()
  if (!cmt || terminating.value) return
  terminateError.value='';terminating.value=true
  try {
    const result = await api(`/alarms/${state.detail.ALARM_KEY}/terminate`, { cmt })
    terminateOpen.value=false;terminateCmt.value=''
    notify('警报已中断')
    await openAlarm(result.alarm || state.detail); emit('changed')
  } catch (error) { terminateError.value = error.message } finally { terminating.value=false }
}
async function perform(action) {
  await act(async () => {
    await api(`/alarms/${state.detail.ALARM_KEY}/${action}`, { cmt: comment.value })
    notify('警报确认成功')
    await openAlarm(state.detail); emit('changed')
  })
}
const columns = {
  NOTIFICATIONS: [['USER_ID','使用者代码'],['USER_NAME','使用者名称'],['CHANNEL','发送方式'],['RESULT','状态'],['SEND_DT','发送时间'],['MESSAGE','说明']],
  TRANSACTIONS: [['SEQ','序号'],['TRX_TYPE','交易类别'],['STATUS_BEFORE','修改前'],['STATUS_AFTER','修改后'],['USER_NAME','使用者名称'],['TRX_DT','修改时间'],['NOTE','备注']],
  LEVELS: [['LEVEL_ID','层级'],['REQUIRED_ACK','需要回应的人数'],['ACK_COUNT','已回应人数'],['RESEND_COUNT','重送次数'],['START_DT','开始时间'],['STATUS','状态']],
  ACKS: [['USER_ID','使用者代码'],['USER_NAME','使用者名称'],['ACK_DT','确认时间'],['ACK_CMT','回应备注']],
}
const info=[['ALARM_ID','警报识别码'],['FACTORY_ID','厂别代码'],['FACTORY_NAME','厂别名称'],['SUB_SYS_ID','子系统代码'],['SUB_SYS_NAME','子系统名称'],['EQP_ID','机台代码'],['ALARM_INFO_ID','警报代码'],['EVENT_ID','事件代码'],['EVENT_NAME','事件名称'],['CREATE_DT','产生时间'],['CONTENT_TYPE','内容类型']]
function value(key){const v=state.detail?.[key];return key.endsWith('_DT')&&v?new Date(v).toLocaleString():v||'—'}
</script>
<template>
  <RecordDialog v-if="state.detail" title="警报详情" wide @close="state.detail = null">
    <h2>{{ state.detail.TITLE }}</h2><div class="detail-meta"><span>{{ state.detail.ALARM_ID }}</span><span class="tag" :class="state.detail.STATUS">{{ state.detail.STATUS }}</span><span>{{ state.detail.FACTORY_ID }} / {{ state.detail.SUB_SYS_ID }} / {{ state.detail.EQP_ID }}</span></div>
    <p v-if="state.detail.HISTORY_CONTEXT" class="warning">历史交易 {{state.detail.HISTORY_CONTEXT.SEQ}} · {{new Date(state.detail.HISTORY_CONTEXT.TRX_DT).toLocaleString()}} · 当时状态 {{state.detail.HISTORY_CONTEXT.STATUS_AFTER}}（只读）</p>
    <div class="tabs"><a-button v-for="(label,key) in {MAIN:'基本资讯',CONTENT:'详细内容',COMMENT:'回应备注'}" :key="key" :class="{active:tab===key}" @click="tab=key" type="default" html-type="button">{{label}}</a-button></div>
    <div v-if="tab==='MAIN'" class="fields"><label v-for="[key,label] in info" :key="key"><span>{{label}}</span><strong>{{value(key)}}</strong></label><label><span>当前账号</span><strong>{{state.user.USER_ID}} {{state.user.USER_NAME}}</strong></label></div>
    <p v-if="tab==='CONTENT'" class="alarm-content">{{ state.detail.CONTENT }}</p>
    <div class="toolbar"><span>LEVEL-{{ state.detail.CURRENT_LEVEL }} · {{ state.detail.LEVEL_ACK_COUNT }} / {{ state.detail.LEVEL_REQUIRED ?? '—' }} {{ t('已回应人数') }}</span><a-button v-if="!state.detail.HISTORY_CONTEXT" @click="openAlarm(state.detail)" type="default" html-type="button">刷新发送与确认状态</a-button></div>
    <label v-if="tab==='COMMENT'" class="comment"><span>{{ t('回应备注') }}</span><a-textarea v-if="state.detail.CAN_ACK" v-model:value="comment" rows="2"/><p v-else>{{state.detail.ACK_CMT||'暂无回应备注'}}</p></label>
    <div v-if="!state.detail.HISTORY_CONTEXT" class="toolbar"><a-button v-if="state.detail.CAN_ACK" class="primary" :disabled="state.busy > 0" @click="perform('ack')" type="primary" html-type="button">{{ t('警报确认') }}</a-button><span v-else class="muted">当前账号暂无待确认操作（邮件待发送、非本层级人员、已确认或告警已结束）。</span><span class="spacer"/><a-button v-if="state.detail.STATUS !== 'Terminated' || !state.detail.TERMINATE_DT" danger :disabled="!canTerminate" @click="openTerminate" html-type="button">{{ t('强制中断') }}</a-button><span v-if="terminateHint" class="muted">{{ t(terminateHint) }}</span></div>
    <div v-if="!state.detail.HISTORY_CONTEXT && state.detail.STATUS === 'Terminated'" class="terminated-banner" data-test="terminated-banner">
      <strong>{{ t('警报已中断') }} · Terminated</strong>
      <span>{{ t('中断后警报将结束且无法恢复 当前层级将关闭 不再发送通知 升级或失败重送') }}</span>
      <dl>
        <dt>{{ t('中断时间') }}</dt><dd>{{ value('TERMINATE_DT') }}</dd>
        <dt>{{ t('中断操作人') }}</dt><dd>{{ state.detail.TERMINATE_USER_NAME || '系统' }}{{ state.detail.TERMINATE_USER_ID ? ` (${state.detail.TERMINATE_USER_ID})` : '' }}</dd>
        <dt>{{ t('中断原因') }}</dt><dd>{{ state.detail.TERMINATE_CMT || '—' }}</dd>
      </dl>
    </div>
    <a-modal :open="terminateOpen" :title="t('确认强制中断警报？')" :width="640" :mask-closable="false" :get-container="terminateContainer"
      wrap-class-name="terminate-modal" destroy-on-close @cancel="closeTerminate">
      <div class="terminate-body">
        <p><strong>{{ state.detail.ALARM_ID }}</strong> · {{ state.detail.TITLE }}</p>
        <p class="terminate-scope">{{ state.detail.FACTORY_ID }} / {{ state.detail.SUB_SYS_ID }} / {{ state.detail.EQP_ID }} · LEVEL-{{ state.detail.CURRENT_LEVEL }}</p>
        <p class="terminate-risk">{{ t('中断后警报将结束且无法恢复 当前层级将关闭 不再发送通知 升级或失败重送') }}</p>
        <label class="comment"><span>{{ t('中断原因') }} * <small>{{ terminateCmt.length }} / {{ TERMINATE_COMMENT_MAX }}</small></span>
          <a-textarea v-model:value="terminateCmt" :maxlength="TERMINATE_COMMENT_MAX" show-count rows="4"
            :placeholder="t('请填写中断原因（例如：机台已修复、误报、事件配置错误）')" aria-label="中断原因"/>
        </label>
        <p v-if="terminateError" class="error" role="alert">{{ terminateError }}</p>
      </div>
      <template #footer>
        <a-button :disabled="terminating" @click="closeTerminate" html-type="button">{{ t('取消') }}</a-button>
        <a-button danger type="primary" :loading="terminating" :disabled="!terminateCmt.trim()" @click="terminate" html-type="button">{{ t('确认中断') }}</a-button>
      </template>
    </a-modal>
    <div class="tabs"><a-button v-for="(label,key) in { NOTIFICATIONS:'通知发送记录', TRANSACTIONS:'交易履历', LEVELS:'事件层级', ACKS:'回应记录' }" :key="key" :class="{ active: recordTab === key }" @click="recordTab = key" type="default" html-type="button">{{ t(label) }}</a-button></div>
    <DataGrid :rows="state.detail[recordTab] || []" :columns="columns[recordTab].map(([field,label]) => ({field,label}))"/>
  </RecordDialog>
</template>
