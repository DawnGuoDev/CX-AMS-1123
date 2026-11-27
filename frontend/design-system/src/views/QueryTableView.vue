<script setup>
import { computed, reactive, ref, watch } from 'vue'
import DataGrid from '../components/DataGrid.vue'
import RecordDialog from '../components/RecordDialog.vue'
import UiCheckbox from '../components/UiCheckbox.vue'
import PageShell from '../components/PageShell.vue'
import PatternFrame from '../components/PatternFrame.vue'
import * as mockModule from '../composables/useMockData.js'

const { clone, mock, runtime, notify } = mockModule
const showQuery = ref(false)
watch(showQuery, open => { if (open) draft.value = clone(conditions) })

const definition = mock.reportDefinition
const conditions = reactive(Object.fromEntries(definition.CONDITIONS.filter(c => ['ALARM_ID', 'TITLE', 'STATUS', 'FACTORY_ID', 'SUB_SYS_ID', 'CREATE_DT', 'EQP_ID'].includes(c.field)).map(c => [c.field, {
  enabled: false, type: c.type, operator: c.type === 'date' ? 'between' : 'contains', value: '', from: '', to: '',
}])))
const draft = ref(null), rows = ref([]), queried = ref(true), countdown = ref(10), dialog = ref(null)
const gridRows = computed(() => rows.value)
function beginQuery() { draft.value = clone(conditions); showQuery.value = true }
function resetDraft() {
  draft.value = Object.fromEntries(definition.CONDITIONS.map(c => [c.field, { enabled: false, type: c.type, operator: c.type === 'date' ? 'between' : 'contains', value: '', from: '', to: '' }]))
}
function applyQuery() {
  Object.assign(conditions, clone(draft.value))
  rows.value = runtime.queryReport({ ALARM_ID: conditions.ALARM_ID, TITLE: conditions.TITLE, STATUS: conditions.STATUS, FACTORY_ID: conditions.FACTORY_ID, SUB_SYS_ID: conditions.SUB_SYS_ID, EQP_ID: conditions.EQP_ID })
  queried.value = true; draft.value = null; showQuery.value = false; notify(`已查询：${rows.value.length} 笔（本地数据）`)
}
rows.value = runtime.alarms
const queryFields = definition.CONDITIONS.filter(c => ['ALARM_ID', 'TITLE', 'STATUS', 'FACTORY_ID', 'SUB_SYS_ID', 'EQP_ID', 'CREATE_DT'].includes(c.field))
const statusOps = ['contains', 'eq', 'neq']
</script>
<template>
  <section class="pattern-doc">
    <div class="gallery-head"><h1>条件查询与结果表格</h1><p>对应生产 AVPA004/AVPA007：查询条件弹窗（勾选启用、运算符组合、秒级日期）、结果表格、列过滤和汇出。所有查询在本地 fixtures 上执行。</p></div>
    <div class="pattern-map"><span>PageShell</span><b>→</b><span>查询 / 汇出工具栏</span><b>→</b><span>查询条件 1120 弹窗</span><b>→</b><span>DataGrid 结果</span><b>→</b><span>列过滤 + 状态标签</span></div>
  </section>
  <PatternFrame>
  <PageShell
   :start-collapsed="false" active-path="/page/AVPA004" title="警报处理查询" description="查询时间区间内所有警报的处理状况；条件与列过滤可叠加。" :links="mock.navLinks" @navigate="path => notify(`本地导航：${path}`)">

  <div class="toolbar" style="margin-top:18px">
    <a-button type="primary" @click="beginQuery">查询</a-button>
    <a-button :disabled="!queried" @click="notify('已重新整理（本地数据）')">重新整理</a-button>
    <span class="muted">{{ countdown }} 秒后自动更新（仅示意）</span>
    <span class="spacer"/>
    <a-button @click="notify('汇出当前画面结果（演示不生成文件）')">汇出</a-button>
  </div>
  <p v-if="!queried" class="panel">请执行查询</p>
  <DataGrid :rows="gridRows" :columns="definition.CMP_COLUMNS.filter(c => ['ALARM_ID', 'CREATE_DT', 'TITLE', 'STATUS', 'FACTORY_ID', 'FACTORY_NAME', 'SUB_SYS_ID', 'SUB_SYS_NAME', 'EQP_ID', 'CURRENT_LEVEL', 'PRIORITY'].includes(c.field)).map(c => ({ ...c, field: c.field }))" row-key="ALARM_KEY" @open="row => dialog = row">
    <template #tools><span class="muted">{{ queried ? '查询结果' : '请执行查询' }}</span></template>
  </DataGrid>
  <a-modal class="record-modal" :open="showQuery" title="查询条件" :width="1120" :footer="null" @cancel="showQuery = false; draft = null">
    <form @submit.prevent="applyQuery">
      <p class="muted">勾选启用的条件同时生效；日期时间精确到秒。未勾选的条件不参与查询。</p>
      <div class="query-fields">
        <label v-for="c in draft ? queryFields : []" :key="c.field">
          <span><UiCheckbox v-model="draft[c.field].enabled"/> {{ c.label }}</span>
          <a-select v-model:value="draft[c.field].operator" :disabled="!draft[c.field].enabled" :options="(c.type === 'date' ? [['between', '介于'], ['eq', '等于'], ['lt', '小于'], ['gt', '大于']] : [['contains', '包含'], ['eq', '等于'], ['neq', '不等于']]).map(([value, label]) => ({ value, label }))"/>
          <div v-if="c.type === 'date' && draft[c.field].operator === 'between'" class="date-range">
            <a-input type="datetime-local" step="1" v-model:value="draft[c.field].from" :disabled="!draft[c.field].enabled" aria-label="起始时间"/><span>—</span>
            <a-input type="datetime-local" step="1" v-model:value="draft[c.field].to" :disabled="!draft[c.field].enabled" aria-label="结束时间"/>
          </div>
          <a-input v-else :type="c.type === 'date' ? 'datetime-local' : 'text'" v-model:value="draft[c.field].value" :disabled="!draft[c.field].enabled" :placeholder="c.type === 'date' ? '选择日期时间' : '输入条件'"/>
        </label>
      </div>
      <div class="form-actions"><a-button @click="resetDraft">清除</a-button><a-button @click="showQuery = false; draft = null">取消</a-button><a-button type="primary" html-type="submit">查询</a-button></div>
    </form>
  </a-modal>
  <RecordDialog :open="!!dialog" title="警报处理查询 · 结果详情" wide @close="dialog = null">
    <p v-if="dialog"><b>{{ dialog.TITLE }}</b> · {{ dialog.ALARM_ID }} · {{ dialog.STATUS }}</p>
    <a-table v-if="dialog" size="middle" :pagination="false" :data-source="[dialog]" :columns="definition.CMP_COLUMNS.slice(0, 10).map(c => ({ ...c, dataIndex: c.field, title: c.label }))"/>
    <div class="form-actions"><a-button @click="dialog = null">关闭</a-button></div>
  </RecordDialog>
  </PageShell>
  </PatternFrame>
</template>
