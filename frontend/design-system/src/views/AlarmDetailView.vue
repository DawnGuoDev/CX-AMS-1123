<script setup>
import { computed, ref, watch } from 'vue'
import DataGrid from '../components/DataGrid.vue'
import RecordDialog from '../components/RecordDialog.vue'
import AmsTabs from '../components/AmsTabs.vue'
import PageShell from '../components/PageShell.vue'
import PatternFrame from '../components/PatternFrame.vue'
import * as mockModule from '../composables/useMockData.js'
import { previewRuntime } from '../../mock/index.js'

const { mock, runtime, notify } = mockModule
const rowVersion = ref(0)
const rows = computed(() => { rowVersion.value; return [...previewRuntime.alarms] })
const open = ref(false)
const tab = ref('MAIN'), recordTab = ref('NOTIFICATIONS'), comment = ref('')
const detail = computed(() => { runtime.alarms; return runtime.detail })
const info = [['ALARM_ID', '警报识别码'], ['FACTORY_ID', '厂别代码'], ['FACTORY_NAME', '厂别名称'], ['SUB_SYS_ID', '子系统代码'], ['SUB_SYS_NAME', '子系统名称'], ['EQP_ID', '机台代码'], ['ALARM_INFO_ID', '警报代码'], ['EVENT_ID', '事件代码'], ['EVENT_NAME', '事件名称'], ['CREATE_DT', '产生时间'], ['CONTENT_TYPE', '内容类型']]
const columns = {
  NOTIFICATIONS: [['USER_ID', '使用者代码'], ['USER_NAME', '使用者名称'], ['CHANNEL', '发送方式'], ['RESULT', '状态'], ['SEND_DT', '发送时间'], ['MESSAGE', '说明']],
  TRANSACTIONS: [['SEQ', '序号'], ['TRX_TYPE', '交易类别'], ['STATUS_BEFORE', '修改前'], ['STATUS_AFTER', '修改后'], ['USER_NAME', '使用者名称'], ['TRX_DT', '修改时间'], ['NOTE', '备注']],
  LEVELS: [['LEVEL_ID', '层级'], ['REQUIRED_ACK', '需要回应的人数'], ['ACK_COUNT', '已回应人数'], ['RESEND_COUNT', '重送次数'], ['START_DT', '开始时间'], ['STATUS', '状态']],
  ACKS: [['USER_ID', '使用者代码'], ['USER_NAME', '使用者名称'], ['ACK_DT', '确认时间'], ['ACK_CMT', '回应备注']],
}
watch(recordTab, () => {})
const recordTabs = [{ key: 'NOTIFICATIONS', label: '通知发送记录' }, { key: 'TRANSACTIONS', label: '交易履历' }, { key: 'LEVELS', label: '事件层级' }, { key: 'ACKS', label: '回应记录' }]
function value(key) { const v = detail.value?.[key]; return key.endsWith('_DT') && v ? new Date(v).toLocaleString() : v || '—' }
function ack() { if (!runtime.acknowledgeAlarm(comment.value)) { notify('当前状态不可确认'); return } rowVersion.value++; comment.value = ''; notify('警报确认成功（仅本地演示）'); open.value = false }
</script>
<template>
  <section class="pattern-doc">
    <div class="gallery-head"><h1>告警详情</h1><p>对应生产 AlarmDetail：1120px 记录弹窗、基本资讯 / 详细内容 / 回应备注 tabs、当前层级 ACK 状态、四组记录表格。打开详情不依赖登录。</p></div>
    <div class="pattern-map"><span>PageShell</span><b>→</b><span>DataGrid 待确认</span><b>→</b><span>RecordDialog 1120</span><b>→</b><span>AmsTabs 基本资讯</span><b>→</b><span>通知/交易/层级/回应记录</span></div>
  </section>
  <PatternFrame><template #default>
  <PageShell :start-collapsed="false" active-path="/page/ACK_LIST" title="待我确认告警" description="当前账号待确认的告警；打开详情后按当前层级确认并写入回应备注。" :links="mock.navLinks" @navigate="path => notify(`本地导航：${path}`)">


  <DataGrid :rows="rows" :columns="mock.alarmColumns" row-key="ALARM_KEY" @open="open = true"><template #tools><span class="muted">10 秒自动更新（示意）</span></template></DataGrid>
  <RecordDialog v-model:open="open" title="警报详情" wide :cancel-text="'关闭'" :ok-text="'确认处理'" @ok="ack">
    <h2>{{ detail.TITLE }}</h2>
    <div class="detail-meta"><span>{{ detail.ALARM_ID }}</span><span class="tag" :class="detail.STATUS">{{ detail.STATUS }}</span><span>{{ detail.FACTORY_ID }} / {{ detail.SUB_SYS_ID }} / {{ detail.EQP_ID }}</span></div>
    <AmsTabs v-model="tab" :items="[{ key: 'MAIN', label: '基本资讯' }, { key: 'CONTENT', label: '详细内容' }, { key: 'COMMENT', label: '回应备注' }]"/>
    <div v-if="tab === 'MAIN'" class="fields"><label v-for="[key] in info" :key="key"><span>{{ info.find(i => i[0] === key)[1] }}</span><strong>{{ value(key) }}</strong></label><label><span>当前账号</span><strong>演示人员 陈柏睿</strong></label></div>
    <p v-if="tab === 'CONTENT'" class="alarm-content">{{ detail.CONTENT }}</p>
    <div class="toolbar"><span>LEVEL-{{ detail.CURRENT_LEVEL }} · {{ detail.LEVEL_ACK_COUNT }} / {{ detail.LEVEL_REQUIRED ?? '—' }} 已回应人数</span><a-button @click="() => {}">刷新发送与确认状态（本地）</a-button></div>
    <div v-if="tab === 'COMMENT'" class="comment"><span>回应备注</span><a-textarea v-if="detail.CAN_ACK" v-model:value="comment" :rows="2"/><p v-else>{{ detail.ACK_CMT || '暂无回应备注' }}</p></div>
    <div class="toolbar"><a-button v-if="detail.CAN_ACK" type="primary" @click="ack">警报确认</a-button><span v-else class="muted">当前账号暂无待确认操作（演示状态）。</span></div>
    <AmsTabs v-model="recordTab" :items="recordTabs"/>
    <DataGrid :rows="detail[recordTab] || []" :columns="columns[recordTab].map(([field, label]) => ({ field, label }))"/>
  </RecordDialog>
  </PageShell>
  </template></PatternFrame>
</template>
