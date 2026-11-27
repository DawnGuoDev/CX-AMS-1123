<script setup>
/**
 * Component catalogue: Ant Design Vue 4.2.6 controls as used by AMS, plus the five repo components.
 * No runtime HTTP fetch is used; component names are not links so the offline guard stays airtight.
 */
import { computed, reactive, ref } from 'vue'
import DataGrid from '../components/DataGrid.vue'
import FieldForm from '../components/FieldForm.vue'
import RecordDialog from '../components/RecordDialog.vue'
import UiCheckbox from '../components/UiCheckbox.vue'
import { mock, runtime, notify } from '../composables/useMockData.js'

const tab = ref('base')
const keyword = ref('')
const input = ref(''), select = ref('A'), check = ref(true), radio = ref('A'), dateTime = ref('')
const dialog = reactive({ open: false, title: '' })
const base = [
  { name: 'Button', zh: '按钮', use: '工具栏、表单操作、表格操作列', preview: 'buttons' },
  { name: 'Input', zh: '输入框', use: '查询栏、主档字段、条件弹窗', preview: 'input' },
  { name: 'Select', zh: '下拉选择', use: '厂别/子系统/机台、部门、班别', preview: 'select' },
  { name: 'Checkbox', zh: '复选框', use: '隐藏资料、启用条件、收件人', preview: 'checkbox' },
  { name: 'Table', zh: '表格', use: '主档、查询结果、发送记录、交易履历', preview: 'table' },
  { name: 'Tag', zh: '标签', use: 'Process / Completed / NoNextLevel / Fail', preview: 'tag' },
  { name: 'Modal', zh: '对话框', use: '记录编辑、查询条件、告警详情', preview: 'modal' },
  { name: 'Alert', zh: '警告提示', use: '错误、SMTP 未配置、储存成功', preview: 'alert' },
  { name: 'Tabs', zh: '页签', use: '资料/履历、基本资讯/详细内容', preview: 'tabs' },
  { name: 'Empty', zh: '空状态', use: '查无资料、搜索无匹配', preview: 'empty' },
  { name: 'Pagination', zh: '分页', use: '20/25/50/100/200/500 每页', preview: 'pagination' },
  { name: 'Form', zh: '表单', use: '校验、必填、布局', preview: 'form' },
  { name: 'Layout / Menu', zh: '布局与菜单', use: 'AppSidebar 使用 Sider + Menu', preview: 'menu' },
  { name: 'Descriptions', zh: '描述列表', use: '参考：告警详情可用；生产现为 fields 网格', preview: 'descriptions' },
]
const ams = [
  { name: 'DataGrid', use: '查询 + 列过滤 + 排序 + 选择 + 分页 + 状态标签', props: 'rows, columns, rowKey, selectable', events: 'select, open, filtered', demo: '#/components/table' },
  { name: 'FieldForm', use: 'metadata 驱动的 2 列字段表单', props: 'fields, model, editing, options', events: 'change', demo: '#/components/form' },
  { name: 'UiCheckbox', use: 'Y/N 与人员数组的边界适配', props: 'modelValue, value, trueValue, falseValue', events: 'update:modelValue, change', demo: '#/components/ams' },
  { name: 'RecordDialog', use: '640/1120px 记录弹窗，父层控制开合', props: 'open, title, wide, footer', events: 'update:open, close, ok', demo: '#/components/ams' },
  { name: 'AppSidebar', use: 'Sider + Menu、分组、搜索、72px 图标模式', props: 'links, activePath, startCollapsed', events: 'navigate', demo: '#/components/ams' },
]
const filteredBase = computed(() => base.filter(item => `${item.name} ${item.zh}`.toLowerCase().includes(keyword.value.toLowerCase())))
const baseColumns = [{ key: 'name', title: '组件' }, { key: 'zh', title: '中文名' }, { key: 'use', title: 'AMS 使用位置' }]
const amsColumns = [{ key: 'name', title: '组件' }, { key: 'use', title: '职责' }, { key: 'props', title: 'Props' }, { key: 'events', title: 'Events' }]
function openDemo(item) { dialog.title = item.name; dialog.open = true }
function save() { dialog.open = false; notify('已关闭示例弹窗（本地状态）') }
</script>
<template>
  <div class="gallery-head"><h1>组件目录</h1>
  <p>基础层以 Ant Design Vue 4.2.6 为准，不在 AMS 内复制原生组件；目录记录「项目实际使用位置」和「公共组件边界」。预览不发网络请求。</p></div>
  <div class="gallery-toolbar"><a-alert type="info" show-icon message="组件 API 与渲染完全遵循 ant-design-vue@4.2.6；本页离线可用。"/><a-input v-model:value="keyword" placeholder="搜索组件（Button / 表格 / Tag…）" allow-clear style="width:320px"/><a-radio-group v-model:value="tab" option-type="button" :options="[{ label: 'Ant Design Vue 基础', value: 'base' }, { label: 'AMS 公共组件', value: 'ams' }]"/></div>
  <section class="example"><div class="example-head"><div><h3>基础组件清单 <span class="muted">{{ filteredBase.length }}</span></h3><p>点击「预览」在当前页打开真实控件（本地状态）。</p></div><span class="badge-local"><i/>LOCAL MOCK</span></div>
    <div class="example-body" v-if="tab === 'base'"><a-table size="middle" :pagination="{ pageSize: 20, hideOnSinglePage: true }" :data-source="filteredBase" row-key="name" :columns="[...baseColumns, { key: 'demo', title: '操作' }]">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'"><code>{{ record.name }}</code></template>
        <template v-else-if="column.key === 'demo'"><a-button type="link" @click="openDemo(record)">预览</a-button></template>
        <template v-else>{{ record[column.key] }}</template>
      </template>
    </a-table></div>
    <div class="example-body" v-else><a-table size="middle" :pagination="false" :data-source="ams" row-key="name" :columns="[...amsColumns, { key: 'demo', title: '演示' }]">
      <template #bodyCell="{ column, record }"><template v-if="column.key === 'name'"><code>{{ record.name }}</code></template><template v-else-if="column.key === 'demo'"><a :href="record.demo">打开</a></template><template v-else>{{ record[column.key] }}</template></template>
    </a-table></div>
  </section>
  <RecordDialog v-model:open="dialog.open" :title="`${dialog.title} · 组件预览`" :footer="null">
    <div class="demo-stack">
      <template v-if="dialog.title === 'Button'"><div class="demo-row"><a-button type="primary">主要</a-button><a-button>次要</a-button><a-button danger>危险</a-button><a-button type="link">链接</a-button></div></template>
      <template v-else-if="dialog.title === 'Input'"><a-input v-model:value="input" placeholder="输入内容"/><a-textarea placeholder="多行内容" :rows="3"/></template>
      <template v-else-if="dialog.title === 'Select'"><a-select v-model:value="select" style="width:280px" :options="mock.options.shift"/></template>
      <template v-else-if="dialog.title === 'Checkbox'"><a-checkbox v-model:checked="check">启用</a-checkbox><a-radio-group v-model:value="radio"><a-radio value="A">A 班</a-radio><a-radio value="B">B 班</a-radio></a-radio-group></template>
      <template v-else-if="dialog.title === 'Table'"><DataGrid :rows="runtime.alarms" :columns="mock.alarmColumns" row-key="ALARM_KEY"/></template>
      <template v-else-if="dialog.title === 'Tag'"><div class="demo-row"><span v-for="s in ['Process', 'Completed', 'NoNextLevel', 'Fail']" :key="s" class="tag" :class="s">{{ s }}</span></div></template>
      <template v-else-if="dialog.title === 'Modal'"><p>当前弹窗即为 RecordDialog 使用的 Ant Design Modal，宽 640px。</p></template>
      <template v-else-if="dialog.title === 'Alert'"><a-alert type="error" show-icon message="错误提示"/><a-alert type="warning" show-icon message="警告提示"/><a-alert type="success" show-icon message="成功提示"/></template>
      <template v-else-if="dialog.title === 'Tabs'"><a-tabs :active-key="'1'"><a-tab-pane key="1" tab="资料">资料页签内容</a-tab-pane><a-tab-pane key="2" tab="履历">履历页签内容</a-tab-pane></a-tabs></template>
      <template v-else-if="dialog.title === 'Empty'"><a-empty description="查无资料"/></template>
      <template v-else-if="dialog.title === 'Pagination'"><a-pagination :total="120" :page-size="20" show-size-changer :page-size-options="['20', '50', '100']"/></template>
      <template v-else-if="dialog.title === 'Form'"><a-form layout="vertical"><a-form-item label="使用者代码"><a-input placeholder="必填"/></a-form-item><a-form-item label="通知 Email"><a-input placeholder="user@example.invalid"/></a-form-item></a-form></template>
      <template v-else-if="dialog.title === 'Layout / Menu'"><p>见「五件套公共组件」页的 AppSidebar；使用 Sider(248/72) + Menu + Sider 断点 lg。</p></template>
      <template v-else-if="dialog.title === 'Descriptions'"><a-descriptions :column="2" size="small" bordered><a-descriptions-item label="警报识别码">ALM202611261000</a-descriptions-item><a-descriptions-item label="状态">Process</a-descriptions-item><a-descriptions-item label="厂别">Fab01</a-descriptions-item><a-descriptions-item label="机台">PRT01</a-descriptions-item></a-descriptions></template>
      <div v-if="dialog.title === 'FieldForm'"><FieldForm :fields="mock.masterMeta.fields" :model="{ ...mock.rows[0], PASSWORD: '' }" :options="mock.options"/></div>
      <UiCheckbox v-if="dialog.title === 'UiCheckbox'" :model-value="'Y'" true-value="Y" false-value="N">Y/N 演示</UiCheckbox>
    </div>
  </RecordDialog>
</template>
