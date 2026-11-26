<script setup>
// Adapted from release components/AlarmDetail.vue: same dialog/tabs/DataGrid structure,
// state comes from the mock host through ./state.
import { Button as AButton, Textarea as ATextarea } from 'ant-design-vue'
import { ref,watch } from 'vue'
import { state, api, act, notify, t, openAlarm } from '../state'
import RecordDialog from './RecordDialog.vue'
import DataGrid from './DataGrid.vue'
const comment = ref(''), tab = ref('MAIN'), recordTab=ref('NOTIFICATIONS')
watch([()=>state.detail?.ALARM_KEY],()=>{ comment.value='';tab.value='MAIN';recordTab.value='NOTIFICATIONS' })
async function perform(action) {
  await act(async () => {
    await api(`/alarms/${state.detail.ALARM_KEY}/${action}`, { cmt: comment.value })
    notify('警报确认成功（预览仅保存在本页内存）')
    await openAlarm(state.detail)
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
    <div class="tabs"><a-button v-for="(label,key) in {MAIN:'基本资讯',CONTENT:'详细内容',COMMENT:'回应备注'}" :key="key" :class="{active:tab===key}" @click="tab=key" type="default" html-type="button">{{label}}</a-button></div>
    <div v-if="tab==='MAIN'" class="fields"><label v-for="[key,label] in info" :key="key"><span>{{label}}</span><strong>{{value(key)}}</strong></label><label><span>当前账号</span><strong>{{state.user.USER_ID}} {{state.user.USER_NAME}}</strong></label></div>
    <p v-if="tab==='CONTENT'" class="alarm-content">{{ state.detail.CONTENT }}</p>
    <div class="toolbar"><span>LEVEL-{{ state.detail.CURRENT_LEVEL }} · {{ state.detail.LEVEL_ACK_COUNT }} / {{ state.detail.LEVEL_REQUIRED ?? '—' }} {{ t('已回应人数') }}</span><a-button @click="openAlarm(state.detail)" type="default" html-type="button">刷新发送与确认状态</a-button></div>
    <label v-if="tab==='COMMENT'" class="comment"><span>{{ t('回应备注') }}</span><a-textarea v-if="state.detail.CAN_ACK" v-model:value="comment" rows="2"/><p v-else>{{state.detail.ACK_CMT||'暂无回应备注'}}</p></label>
    <div class="toolbar"><a-button v-if="state.detail.CAN_ACK" class="primary" :disabled="state.busy > 0" @click="perform('ack')" type="primary" html-type="button">{{ t('警报确认') }}</a-button><span v-else class="muted">当前账号暂无待确认操作（预览数据已确认或告警已结束）。</span></div>
    <div class="tabs"><a-button v-for="(label,key) in { NOTIFICATIONS:'通知发送记录', TRANSACTIONS:'交易履历', LEVELS:'事件层级', ACKS:'回应记录' }" :key="key" :class="{ active: recordTab === key }" @click="recordTab = key" type="default" html-type="button">{{ t(label) }}</a-button></div>
    <DataGrid :rows="state.detail[recordTab] || []" :columns="columns[recordTab].map(([field,label]) => ({field,label}))"/>
  </RecordDialog>
</template>
