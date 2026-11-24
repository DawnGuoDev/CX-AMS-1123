<script setup>
import { ref } from 'vue'
import { state, api, act, notify, t, openAlarm } from '../state'
import RecordDialog from './RecordDialog.vue'
import DataGrid from './DataGrid.vue'
const emit = defineEmits(['changed'])
const comment = ref(''), tab = ref('NOTIFICATIONS')
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
</script>
<template>
  <RecordDialog v-if="state.detail" title="警报详情" wide @close="state.detail = null">
    <h2>{{ state.detail.TITLE }}</h2><div class="detail-meta"><span>{{ state.detail.ALARM_ID }}</span><span class="tag" :class="state.detail.STATUS">{{ state.detail.STATUS }}</span><span>{{ state.detail.FACTORY_ID }} / {{ state.detail.SUB_SYS_ID }} / {{ state.detail.EQP_ID }}</span></div>
    <p class="alarm-content">{{ state.detail.CONTENT }}</p>
    <div class="toolbar"><span>LEVEL-{{ state.detail.CURRENT_LEVEL }} · {{ state.detail.LEVEL_ACK_COUNT }} / {{ state.detail.LEVEL_REQUIRED ?? '—' }} {{ t('已回应人数') }}</span><button @click="openAlarm(state.detail)">刷新发送与确认状态</button></div>
    <label v-if="state.detail.CAN_ACK" class="comment"><span>{{ t('回应备注') }}</span><textarea v-model="comment" rows="2"/></label>
    <div class="toolbar"><button v-if="state.detail.CAN_ACK" class="primary" :disabled="state.busy > 0" @click="perform('ack')">{{ t('警报确认') }}</button><span v-else class="muted">当前账号暂无待确认操作（邮件待发送、非本层级人员、已确认或告警已结束）。</span></div>
    <div class="tabs"><button v-for="(label,key) in { NOTIFICATIONS:'通知发送记录', TRANSACTIONS:'交易履历', LEVELS:'事件层级', ACKS:'回应记录' }" :key="key" :class="{ active: tab === key }" @click="tab = key">{{ t(label) }}</button></div>
    <DataGrid :rows="state.detail[tab] || []" :columns="columns[tab].map(([field,label]) => ({field,label}))"/>
  </RecordDialog>
</template>
