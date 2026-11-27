<script setup>
import { computed, reactive, ref } from 'vue'
import DataGrid from '../components/DataGrid.vue'
import FieldForm from '../components/FieldForm.vue'
import RecordDialog from '../components/RecordDialog.vue'
import UiCheckbox from '../components/UiCheckbox.vue'
import AmsTabs from '../components/AmsTabs.vue'
import PageShell from '../components/PageShell.vue'
import PatternFrame from '../components/PatternFrame.vue'
import * as mockModule from '../composables/useMockData.js'

const { clone, mock, runtime, notify } = mockModule
const rows = computed(() => runtime.rows)
const mockData = mock
const preferredFields = ['USER_ID', 'USER_NAME', 'GENDER', 'E_MAIL', 'TITLE', 'SHIFT_KEY', 'ORGAN_KEY', 'HIRE_DATE', 'ACTIVE']
const columns = computed(() => preferredFields.map(field => {
  const meta = mockData.masterMeta.fields.find(f => f.name === field)
  return { field, label: meta?.label || field, type: meta?.type }
}))
const tab = ref('data'), selected = ref([]), showHidden = ref(false)
const edit = reactive({ open: false, editing: false, model: {} })
const history = [
  { ACTION: 'Modify', RECORD_LABEL: 'E0043258', ACTIVE: 'Y', TRX_DT: '2026-11-20T08:12:00.000Z', USER_ID: 'E0043258', USER_NAME: '陈柏睿', IP: '127.0.0.1', HOST: 'demo', BEFORE_JSON: '{"TITLE":"设备工程师"}', AFTER_JSON: '{"TITLE":"高级设备工程师"}' },
]
function start(row, copy = false) {
  edit.editing = !!row && !copy
  edit.model = clone(row || { ACTIVE: 'Y', SHIFT_KEY: 'A', GENDER: 'M', IS_EMPLOYEE: 'Y' })
  if (copy) { delete edit.model.USER_KEY }
  edit.model.PASSWORD = ''
  edit.open = true
}
function save() {
  const missing = mockData.masterMeta.fields.find(f => (f.required || (f.requiredOnCreate && !edit.editing)) && String(edit.model[f.name] ?? '').trim() === '')
  if (missing) { notify(`${missing.label}为必填`); return }
  runtime.saveMaster('/master/SBRM_USER', edit.model)
  edit.open = false
  notify('储存成功（仅本地演示）')
}
</script>
<template>
  <section class="pattern-doc">
    <div class="gallery-head"><h1>主档编辑</h1><p>对应生产 SBRM_USER：页头说明 → 工具栏 → 主档表格 → 宽弹窗编辑（<code>FieldForm</code>）→ 履历。示例数据为本地 fixtures，储存不会发送请求。</p></div>
    <div class="pattern-map"><span>PageShell</span><b>→</b><span>工具栏（新增/复制/修改/隐藏）</span><b>→</b><span>DataGrid 主档</span><b>→</b><span>RecordDialog 1120</span><b>→</b><span>FieldForm 2 列</span></div>
  </section>
  <PatternFrame><template #default>
  <PageShell :start-collapsed="false" active-path="/page/SBRM_USER" title="使用者设定与管理" description="维护使用者基本资料与 Email 通知地址。" :links="mockData.navLinks" @navigate="path => notify(`本地导航：${path}`)">
    <div class="toolbar">
    <a-button type="primary" @click="start()">新增</a-button>
    <a-button :disabled="selected.length !== 1" @click="start(selected[0], true)">复制</a-button>
    <a-button :disabled="selected.length !== 1" @click="start(selected[0])">修改</a-button>
    <a-button :disabled="!selected.length" @click="notify('已隐藏所选资料（仅本地演示）')">隐藏</a-button>
    <a-button :disabled="!selected.length" @click="notify('已取消隐藏（仅本地演示）')">取消隐藏</a-button>
    <label class="check"><UiCheckbox v-model="showHidden" @change="() => notify('显示已隐藏资料（本地筛选）')"/>显示已隐藏资料</label>
    <a-button @click="notify('已重新整理（本地数据）')">重新整理</a-button>
    <span class="spacer"/>
    <a-button @click="notify('汇出为 Excel（演示不生成文件）')">汇出</a-button>
    <a-button @click="notify('汇出范本（演示不生成文件）')">汇出范本</a-button>
    <a-button @click="notify('汇入：请选择 .xlsx（演示不读取文件）')">汇入</a-button>
  </div>
  <AmsTabs v-model="tab" :items="[{ key: 'data', label: '资料' }, { key: 'history', label: '履历' }]"/>
  <DataGrid v-if="tab === 'history'" :rows="history" :columns="mockData.historyColumns"/>
  <DataGrid v-else :rows="rows" :columns="columns" row-key="USER_KEY" selectable @select="selected = $event" @open="start">
    <template #actions="{ row }"><a-button type="link" @click="start(row, true)">复制</a-button></template>
  </DataGrid>
  <RecordDialog v-model:open="edit.open" :title="edit.editing ? '修改使用者' : '新增使用者'" wide>
    <FieldForm :fields="mockData.masterMeta.fields" :model="edit.model" :editing="edit.editing" :options="mockData.options"/>
    <div class="form-actions"><a-button @click="edit.open = false">取消</a-button><a-button type="primary" @click="save">储存</a-button></div>
  </RecordDialog>
  </PageShell>
  </template></PatternFrame>
</template>
