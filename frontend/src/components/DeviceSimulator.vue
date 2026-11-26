<script setup>
import UiCheckbox from './UiCheckbox.vue'
import { Button as AButton, Input as AInput, Select as ASelect, SelectOption as ASelectOption } from 'ant-design-vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { api, openAlarm, state } from '../state'
import { createSimulation, scenarios } from '../simulator'

const props = defineProps({ form: Object })
const emit = defineEmits(['busy'])
const mode = ref('preview'), scenario = ref('once'), threshold = ref(80), interval = ref(5), rounds = ref(1)
const running = ref(false), paused = ref(false), pending = ref(false), current = ref(null)
const logs = ref([]), samples = ref([]), error = ref(''), status = ref('未开始')
const counts = ref({ crossings: 0, accepted: 0, suppressed: 0 })
const config = ref(null), loading = ref(false), confirmed = ref(false), loadedAt = ref('')
let runner, disposed = false, configVersion = 0
const busy = computed(() => running.value || pending.value)
watch(busy, value => emit('busy', value), { flush: 'sync' })
const selected = computed(() => ['factoryKey', 'subsysKey', 'eqpKey', 'alarmCode'].every(key => props.form[key]))
const setting = computed(() => {
  const rows = (config.value?.settings || []).filter(row => row.FACTORY_KEY === props.form.factoryKey &&
    row.SUB_SYS_KEY === props.form.subsysKey && row.ALARM_INFO_ID === props.form.alarmCode)
  return rows.find(row => row.EQP_KEY === props.form.eqpKey) || rows.find(row => row.EQP_KEY === '*')
})
const event = computed(() => config.value?.events.find(row => row.EVENT_KEY === setting.value?.EVENT_KEY && row.ACTIVE !== 'N'))
const levels = computed(() => (config.value?.levels || []).filter(row => row.EVENT_KEY === event.value?.EVENT_KEY && row.ACTIVE !== 'N')
  .sort((a, b) => Number(a.EVENT_LEVEL_ID) - Number(b.EVENT_LEVEL_ID)))
const ready = computed(() => selected.value && setting.value?.ACTIVE !== 'N' && event.value && levels.value.some(row => Number(row.EVENT_LEVEL_ID) === 1))
const points = computed(() => samples.value.map((sample, i) => `${20 + i * 560 / Math.max(1, samples.value.length - 1)},${100 - (sample.value - threshold.value) * 4}`).join(' '))
function recipients(level) {
  return (level.USER_KEYS || []).map(key => {
    const user = config.value?.users.find(row => row.USER_KEY === key)
    return user ? `${user.USER_NAME} <${user.E_MAIL || '未设邮箱'}>${user.ACTIVE === 'N' ? '（已隐藏）' : ''}` : `${key}（不存在）`
  }).join('；')
}
function log(message, alarm) {
  logs.value.unshift({ time: new Date().toLocaleTimeString(), message, alarm })
  logs.value = logs.value.slice(0, 160)
}
async function loadConfig() {
  const version = ++configVersion
  loading.value = true; confirmed.value = false; error.value = ''
  try {
    const settings = await api('/master/AVMA009?showHidden=1')
    const events = await api('/masterdetail/AVMA007')
    const users = await api('/master/SBRM_USER?showHidden=1')
    const subsystems = await api('/master/AVMA003')
    if (disposed || version !== configVersion) return
    config.value = { settings: settings.rows, events: events.masters, levels: events.details, users: users.rows, subsystems: subsystems.rows }
    loadedAt.value = new Date().toLocaleTimeString()
  } catch (e) { if (!disposed && version === configVersion) { config.value = null; error.value = e.message } }
  finally { if (version === configVersion) loading.value = false }
}
watch(() => [props.form.factoryKey, props.form.subsysKey, props.form.eqpKey, props.form.alarmCode, mode.value],
  () => { confirmed.value = false })
async function sample(data) {
  if (disposed || !running.value) return
  // Also check visibility at the submission boundary, before any await.
  if (document.hidden) { stop(); return }
  current.value = data
  samples.value.push(data)
  if (data.recovered) log(`${data.value} °C：恢复正常；已有告警仍需 ACK`)
  else log(`${data.value} °C：${data.high ? '超温' : '正常'}${data.high && !data.crossing ? '，持续超温不重复提交' : ''}`)
  if (!data.crossing) return
  counts.value.crossings++
  if (mode.value === 'preview') { log('预览：检测到超温，将触发一次告警（未提交）'); return }
  pending.value = true
  try {
    const result = await api('/alarms/test', {
      ...props.form,
      title: `[设备模拟] 温度超限 ${data.value} °C`,
      content: `设备温度模拟；采样 ${data.index}/${data.total}；温度 ${data.value} °C > 阈值 ${threshold.value} °C；时间 ${new Date().toISOString()}`,
    })
    if (disposed) return
    counts.value.accepted++
    log('已受理；邮件异步发送，请打开详情查看 SMTP 结果', result.alarm)
  } catch (e) {
    if (disposed) return
    if (e.status === 422 && e.message === '忽略相同警报') {
      counts.value.suppressed++; log('重复抑制：仍在忽略间隔内，本次未创建告警')
    } else {
      error.value = `提交失败：${e.message}。若连接中断，请先查询警报记录确认是否已受理，再重新开始。`
      log(error.value); stop()
    }
  } finally { pending.value = false }
}
function start() {
  if (busy.value || !ready.value || loading.value || document.hidden || (mode.value === 'actual' && !confirmed.value)) return
  error.value = ''
  try {
    runner = createSimulation({
      scenario: scenario.value, threshold: threshold.value, rounds: rounds.value, interval: interval.value,
      onSample: sample,
      onFinish(e) { running.value = false; paused.value = false; status.value = e ? '失败' : '本轮完成'; if (e) error.value = e.message; log(status.value) },
    })
    current.value = null; samples.value = []; logs.value = []
    counts.value = { crossings: 0, accepted: 0, suppressed: 0 }
    running.value = true; status.value = '运行中'
    log(mode.value === 'preview' ? '开始预览：不会创建告警或发送邮件' : '开始实际触发：按现有通知配置发送邮件')
    runner.start()
  } catch (e) { error.value = e.message }
}
function stop() {
  runner?.stop(); running.value = false; paused.value = false
  status.value = '已停止'
}
function visibility() {
  if (!running.value) return
  if (document.hidden) {
    runner.pause(); paused.value = true; status.value = '后台暂停'
    log('页面不可见，暂停采样；返回后继续，不补发错过的数据')
  } else {
    runner.resume(); paused.value = false; status.value = '运行中'
  }
}
onMounted(() => { loadConfig(); document.addEventListener('visibilitychange', visibility) })
onUnmounted(() => { disposed = true; runner?.stop(); document.removeEventListener('visibilitychange', visibility); emit('busy', false) })
</script>
<template>
  <div class="simulator">
    <p class="description">单机台温度模拟：仅在温度从正常变为高于阈值时触发。恢复后允许再次触发，仍受后台重复抑制约束。</p>
    <form @submit.prevent="start">
      <fieldset :disabled="busy">
        <div class="fields">
          <label><span>运行模式</span><a-select :disabled="busy" v-model:value="mode"><a-select-option value="preview">仅预览（默认，不提交）</a-select-option><a-select-option value="actual">实际触发（创建告警并发送邮件）</a-select-option></a-select></label>
          <label><span>温度场景</span><a-select :disabled="busy" v-model:value="scenario"><a-select-option v-for="(item,key) in scenarios" :key="key" :value="key">{{ item.label }}</a-select-option></a-select></label>
          <label><span>超温阈值（°C）</span><a-input :value="threshold" @update:value="threshold = $event === '' ? null : Number($event)" type="number" min="-100" max="1000" step="0.1" required/></label>
          <label><span>采样间隔（秒，1–60）</span><a-input :value="interval" @update:value="interval = $event === '' ? null : Number($event)" type="number" min="1" max="60" required/></label>
          <label><span>运行轮数（1–10）</span><a-input :value="rounds" @update:value="rounds = $event === '' ? null : Number($event)" type="number" min="1" max="10" required/></label>
          <div class="description">每轮序列：{{ scenarios[scenario].offsets.map(offset => Number((Number(threshold) + offset).toFixed(1))).join(' → ') }} °C<br>开始后等待一个采样间隔产生首条数据。</div>
        </div>
      </fieldset>
      <div class="level-card">
        <div class="toolbar"><strong>通知配置预览</strong><a-button :disabled="busy || loading" @click="loadConfig" type="default" html-type="button">{{ loading ? '读取中…' : '刷新配置' }}</a-button></div>
        <p v-if="!selected" class="muted">请先选择厂别、子系统、机台和警报代码。</p>
        <template v-else-if="ready">
          <p>{{ event.EVENT_ID }} · {{ event.EVENT_NAME }}；重复抑制 {{ setting.IGNORE_PERIOD ?? 900 }} 秒</p>
          <p v-for="level in levels" :key="level.EVENT_LEVEL_KEY" class="sim-recipients">LEVEL-{{ level.EVENT_LEVEL_ID }} · {{ level.LEVEL_INTERVAL }} 分钟升级 · ACK {{ level.NUMBER_OF_ACK_USERS }} 人<br>{{ recipients(level) }}</p>
        </template>
        <p v-else-if="!loading" class="warning">当前组合没有可用通知配置，请检查警报设定、事件及层级。</p>
        <small v-if="loadedAt">读取于 {{ loadedAt }}；实际提交使用服务器当前配置。修改配置后请刷新预览。</small>
      </div>
      <div v-if="mode === 'actual'" class="warning">
        <p>实际触发会创建真实告警，按以上各层级通知人员发送邮件。提交成功不等于 SMTP 发送成功。</p>
        <label><UiCheckbox v-model="confirmed"  :disabled="busy || loading || !ready"/>我已核对各层收件人，确认本次使用实际触发</label>
      </div>
      <p class="muted">切换页签、离开页面或刷新会停止新采样；浏览器切到后台自动暂停。停止或温度恢复不会撤销已提交的告警，也不会自动 ACK。</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="toolbar">
        <a-button class="primary" :disabled="busy || loading || !ready || (mode === 'actual' && !confirmed)" type="primary" html-type="submit">{{ mode === 'preview' ? '开始预览' : '开始实际触发' }}</a-button>
        <a-button :disabled="!running" @click="stop" type="default" html-type="button">停止模拟</a-button>
        <span role="status">{{ status }}{{ pending ? ' · 等待已提交请求返回' : '' }}</span>
      </div>
    </form>
    <div class="kpis sim-kpis">
      <div class="kpi"><small>当前温度</small><strong>{{ current ? `${current.value} °C` : '—' }}</strong><small>{{ current ? `${current.high ? '超温' : '正常'} · 采样 ${current.index}/${current.total}` : '等待采样' }}</small></div>
      <div class="kpi"><small>超温触发次数</small><strong>{{ counts.crossings }}</strong><small>包含预览检测</small></div>
      <div class="kpi"><small>已创建告警</small><strong>{{ counts.accepted }}</strong><small>服务器已受理</small></div>
      <div class="kpi"><small>重复抑制</small><strong>{{ counts.suppressed }}</strong><small>本次未创建</small></div>
    </div>
    <svg v-if="samples.length" class="sim-chart" viewBox="0 0 600 190" role="img" aria-label="本轮温度趋势，虚线表示超温阈值">
      <line x1="20" y1="100" x2="580" y2="100" stroke="#c68a25" stroke-dasharray="5 5"/>
      <text x="22" y="92" fill="#94651b" font-size="12">阈值 {{ threshold }} °C</text>
      <polyline :points="points" fill="none" stroke="#167d92" stroke-width="3"/>
      <circle v-for="(s,i) in samples" :key="i" :cx="20 + i * 560 / Math.max(1, samples.length - 1)" :cy="100 - (s.value - threshold) * 4" r="3" :fill="s.high ? '#c14848' : '#167d92'"/>
    </svg>
    <div class="sim-log" aria-label="模拟日志">
      <p v-if="!logs.length" class="muted">开始后在此查看采样、触发与恢复记录。</p>
      <p v-for="(entry,i) in logs" :key="i"><time>{{ entry.time }}</time> {{ entry.message }} <a-button v-if="entry.alarm" class="link" @click="openAlarm(entry.alarm)" type="link" html-type="button">{{ entry.alarm.ALARM_ID }} · 查看详情</a-button></p>
    </div>
  </div>
</template>
<style scoped>
fieldset{border:0;padding:0;margin:0;min-width:0}
.sim-recipients{line-height:1.8;overflow-wrap:anywhere}
.sim-kpis .kpi{padding:16px}.sim-kpis strong{font-size:26px}
.sim-chart{width:100%;max-height:220px;background:#f7fafb;border:1px solid var(--border);border-radius:6px}
.sim-log{max-height:280px;overflow:auto;margin-top:18px;background:#f6f8fa;padding:16px;border-radius:6px}
.sim-log p{font-size:12px;line-height:1.8;margin-bottom:8px}.sim-log time{color:var(--muted);margin-right:8px}
</style>
