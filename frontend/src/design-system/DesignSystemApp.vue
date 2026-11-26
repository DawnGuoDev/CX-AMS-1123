<script setup>
import { ConfigProvider as AConfigProvider, Button as AButton, Input as AInput, Select as ASelect, SelectOption as ASelectOption, Alert as AAlert } from 'ant-design-vue'
import { onMounted, reactive, ref } from 'vue'
import AppSidebar from '../components/AppSidebar.vue'
import DataGrid from '../components/DataGrid.vue'
import FieldForm from '../components/FieldForm.vue'
import UiCheckbox from '../components/UiCheckbox.vue'
import RecordDialog from '../components/RecordDialog.vue'
import AlarmDetail from '../components/AlarmDetail.vue'
import { state, t } from '../state'
import { localUser, localNav, masterRows, masterColumns, masterFields, queryRows, queryColumns, alarmDetail } from './data.js'

const masterModel = reactive({
  USER_ID: 'E0043288',
  USER_NAME: '林彦廷',
  E_MAIL: 'yan-ting@example.invalid',
  IS_EMPLOYEE: 'Y',
  NOTE: '修改时保留既有 Email 通知地址。',
})
const showHidden = ref('N')
const recordOpen = ref(false)
const masterOpen = ref(false)
const alarmOpen = ref(false)
const queryResult = ref(masterRows)
const selectedRows = ref([])

function openMaster() { masterOpen.value = true }
function openRecord() { recordOpen.value = true }
function openAlarm() { state.detail = JSON.parse(JSON.stringify(alarmDetail)); alarmOpen.value = true }

onMounted(() => {
  state.user = { ...localUser }
  state.nav = JSON.parse(JSON.stringify(localNav))
  state.options = {
    gender: [{ value: 'M', label: 'M' }, { value: 'F', label: 'F' }],
    shift: [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }],
    department: [{ value: 'MES', label: '制造执行' }],
  }
})
</script>

<template>
  <a-config-provider :auto-insert-space-in-button="false" :locale="undefined" :theme="{ token: { colorPrimary: '#167d92', borderRadius: 6, fontSize: 13 } }">
    <div class="app-shell ds-scope">
      <AppSidebar />
      <div class="main-shell">
        <header class="topbar">
          <span class="muted">CHANGXIN / 设计系统预览</span>
          <div class="top-actions"><span>本地数据 · 无登录 · 无 Java 后端</span></div>
        </header>
        <main>
          <div class="page-heading"><h1>AMS Design System</h1><p class="description">Ant Design Vue 4.2.6 基础组件 + AMS 产品规范 + 业务组合。以下数据只来自本地模块。</p></div>

          <section class="ds-section">
            <h2>1 · Design tokens</h2>
            <p class="ds-source">来源：App.vue ConfigProvider、frontend/src/style.css、DataGrid 状态标签规则。</p>
            <div class="ds-card-grid">
              <div class="ds-token"><strong>主题</strong><small>Primary #167d92 · Border #dde5ed · Radius 6px</small></div>
              <div class="ds-token"><strong>布局</strong><small>Sider 248 / collapsed 72 · topbar 68 · main padding 26px 28px</small></div>
              <div class="ds-token"><strong>表格密度</strong><small>size="middle"，默认 20 / 页，可选 20、25、50、100、200、500。</small></div>
            </div>
            <div class="ds-status-grid">
              <div class="ds-status ds-success">Success / Completed / OK / Y</div>
              <div class="ds-status ds-warning">Process / Unknown</div>
              <div class="ds-status ds-danger">Fail / Error / NoNextLevel / NG</div>
              <div class="ds-status ds-neutral">Terminated / N</div>
            </div>
          </section>

          <section class="ds-section">
            <h2>2 · 基础组件</h2>
            <p class="ds-source">基础组件以 Ant Design Vue 4.2.6 为准；AMS 只通过业务样式安排布局与状态表达。</p>
            <div class="ds-component-list">
              <div><h3>输入与选择</h3><div class="ds-controls"><a-input placeholder="使用者代码" /><a-select style="min-width: 150px"><a-select-option value="Fab01">Fab01</a-select-option><a-select-option value="Fab02">Fab02</a-select-option></a-select></div></div>
              <div><h3>按钮与反馈</h3><div class="ds-controls"><a-button type="primary">主操作</a-button><a-button>次操作</a-button><a-button type="link">链接</a-button></div><a-alert class="ds-combo-note" message="错误信息使用 AAlert，页面成功提示保持 AMS toast。" type="info" show-icon /></div>
              <div><h3>UiCheckbox 边界适配</h3><div class="ds-controls"><UiCheckbox v-model="showHidden" true-value="Y" false-value="N">显示已隐藏资料</UiCheckbox><span class="muted">当前值：{{ showHidden }}</span></div></div>
            </div>
            <div class="ds-card-grid">
              <div class="ds-token"><strong>DataGrid</strong><ul><li>Ant Table + 本地搜索 / 列过滤 / 排序 / 分页</li><li>状态列映射 AMS 状态颜色</li></ul></div>
              <div class="ds-token"><strong>FieldForm</strong><ul><li>Ant Input / Textarea / Select / UiCheckbox</li><li>必填标示与字段帮助保留</li></ul></div>
              <div class="ds-token"><strong>RecordDialog</strong><ul><li>Ant Modal centered，宽 640 / wide 1120</li><li>弹窗内最大高度 75vh</li></ul></div>
            </div>
          </section>

          <section class="ds-section">
            <h2>3 · 代表组合预览</h2>
            <div class="ds-card-grid">
              <div class="ds-token"><strong>主档编辑</strong><small>DataGrid 选择 + RecordDialog + FieldForm + UiCheckbox</small><div class="ds-combo-actions"><a-button type="primary" @click="openMaster">打开预览</a-button></div></div>
              <div class="ds-token"><strong>条件查询与结果表格</strong><small>条件开关 / 运算符 / 结果交集 / DataGrid</small><div class="ds-combo-actions"><a-button type="primary" @click="openRecord">打开预览</a-button></div></div>
              <div class="ds-token"><strong>告警详情</strong><small>RecordDialog wide + 基本资讯 / 内容 / 回应备注 + 履历 Grid</small><div class="ds-combo-actions"><a-button type="primary" @click="openAlarm">打开预览</a-button></div></div>
            </div>

            <div class="panel">
              <div class="toolbar"><h3 style="margin: 0">DataGrid 基准</h3><span class="spacer" /><span class="muted">数据：masterRows</span></div>
              <DataGrid :rows="queryRows" :columns="queryColumns" selectable row-key="ALARM_KEY" @select="selectedRows = $event" @open="openRecord" />
            </div>
          </section>
        </main>
        <footer class="page-footer"><span>AMS Design System · 本地预览</span><span>{{ selectedRows.length }} selected</span></footer>
      </div>
    </div>

    <RecordDialog v-if="recordOpen" title="条件查询与结果表格" wide @close="recordOpen = false">
      <div class="query-fields">
        <label><span>警报识别码</span><a-input placeholder="ALM-" /></label>
        <label><span>厂别</span><a-select style="min-width: 150px"><a-select-option value="Fab01">Fab01</a-select-option><a-select-option value="Fab02">Fab02</a-select-option></a-select></label>
        <label><span><UiCheckbox v-model="masterModel.IS_EMPLOYEE" true-value="Y" false-value="N">启用时间条件</UiCheckbox></span><a-input type="datetime-local" step="1" /></label>
        <label><span>状态</span><a-select style="min-width: 150px"><a-select-option value="Process">Process</a-select-option><a-select-option value="Completed">Completed</a-select-option><a-select-option value="NoNextLevel">NoNextLevel</a-select-option></a-select></label>
      </div>
      <DataGrid class="ds-combo-note" :rows="queryRows" :columns="queryColumns" row-key="ALARM_KEY" />
    </RecordDialog>

    <RecordDialog v-if="masterOpen" title="修改" wide @close="masterOpen = false">
      <FieldForm :fields="masterFields" :model="masterModel" :editing="true" />
      <div class="form-actions"><a-button @click="masterOpen = false">取消</a-button><a-button type="primary">储存</a-button></div>
    </RecordDialog>

    <AlarmDetail v-if="state.detail" />
  </a-config-provider>
</template>
