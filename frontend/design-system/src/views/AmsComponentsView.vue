<script setup>
import { computed, reactive, ref } from 'vue'
import DataGrid from '../components/DataGrid.vue'
import FieldForm from '../components/FieldForm.vue'
import UiCheckbox from '../components/UiCheckbox.vue'
import RecordDialog from '../components/RecordDialog.vue'
import AppSidebar from '../components/AppSidebar.vue'
import { clone, mock, runtime, notify } from '../composables/useMockData.js'

const users = computed(() => runtime.rows)
const userColumns = [{ field: 'USER_ID', label: '使用者代码' }, { field: 'USER_NAME', label: '使用者名称' }, { field: 'GENDER', label: '性别' }, { field: 'E_MAIL', label: 'E-Mail' }, { field: 'TITLE', label: '职称' }, { field: 'ORGAN_KEY', label: '部门' }, { field: 'SHIFT_KEY', label: '班别' }, { field: 'ACTIVE', label: '状态' }]
const active = ref('/page/SBRM_USER')
const dialog = reactive({ open: false, title: '新增使用者', model: {} })
const direction = ref('Y'), recipients = ref(['U001', 'U006']), showHidden = ref(false)
const flags = ref('Y')
const navLinks = mock.masterMeta.code ? [
  { id: 'SBRM_USER', code: 'SBRM_USER', name: '使用者设定', path: '/page/SBRM_USER' },
  { id: 'SBRM_FACTORY', code: 'SBRM_FACTORY', name: '厂别设定', path: '/page/SBRM_FACTORY' },
  { id: 'SBRM_EQP', code: 'SBRM_EQP', name: '机台设定', path: '/page/SBRM_EQP' },
  { id: 'AVMA003', code: 'AVMA003', name: '子系统设定', path: '/page/AVMA003' },
  { id: 'AVMA004', code: 'AVMA004', name: '厂别子系统对应设定', path: '/page/AVMA004' },
  { id: 'AVMA007', code: 'AVMA007', name: '事件通知设定', path: '/page/AVMA007' },
  { id: 'AVMA009', code: 'AVMA009', name: '警报通知设定', path: '/page/AVMA009' },
  { id: 'AVPA013', code: 'AVPA013', name: '即时警报汇总', path: '/page/AVPA013' },
  { id: 'AVPA004', code: 'AVPA004', name: '警报处理查询', path: '/page/AVPA004' },
  { id: 'AVPA007', code: 'AVPA007', name: '历史记录查询', path: '/page/AVPA007' },
  { id: 'TEST', code: 'TEST', name: '测试告警触发', path: '/page/TEST' },
  { id: 'ACK_LIST', code: 'ACK_LIST', name: '待我确认', path: '/page/ACK_LIST' },
] : []
function open(row) {
  dialog.title = `修改 ${row.USER_NAME}`
  dialog.model = { ...clone(row), PASSWORD: '' }
  dialog.open = true
}
</script>
<template>
  <div class="gallery-head"><h1>AMS 公共组件</h1><p>五件套取自仓库实际组件，保留 DOM、样式与事件语义；只把对 <code>state</code>/<code>api</code>/<code>vue-router</code> 的依赖改为 props + emits，以便离线预览。</p></div>
  <section class="example"><div class="example-head"><div><h3>UiCheckbox</h3><p>API 的 Y/N 与收件人数组在组件边界适配；父层不需要拆解字符串。</p></div></div>
    <div class="example-body demo-stack">
      <div class="demo-row"><UiCheckbox v-model="direction" true-value="Y" false-value="N">整笔资料启用（当前值 <code>{{ direction }}</code>）</UiCheckbox></div>
      <div class="demo-row" style="gap:16px"><label v-for="u in mock.options.user.slice(0, 4)" :key="u.value" class="check"><UiCheckbox v-model="recipients" :value="u.value"/>{{ u.label }}</label></div>
      <div class="note">recipients = <code>{{ JSON.stringify(recipients) }}</code></div>
    </div>
  </section>
  <section class="example"><div class="example-head"><div><h3>FieldForm</h3><p>由 metadata 驱动；必填、编辑只读、辅助说明、宽字段和 select/checkbox 类型均由字段定义控制。</p></div></div>
    <div class="example-body">
      <FieldForm :fields="mock.masterMeta.fields" :model="{ ...mock.rows[0], PASSWORD: '' }" :options="mock.options"/>
      <a-button type="primary" @click="notify('FieldForm 演示：字段值已由 v-model 回写')">校验并储存</a-button>
    </div>
  </section>
  <section class="example"><div class="example-head"><div><h3>DataGrid</h3><p>行选择、查看动作、状态标签、列过滤和分页尺寸均为真实实现；数据来自本地 fixtures。</p></div></div>
    <div class="example-body"><DataGrid :rows="users" :columns="userColumns" row-key="USER_KEY" selectable @open="open"><template #tools><span class="muted">Users fixture: {{ users.length }}</span></template></DataGrid></div>
  </section>
  <section class="example"><div class="example-head"><div><h3>RecordDialog</h3><p>由父层 v-model:open 控制；720px 以下自适应；宽模式 1120px，与生产主档编辑弹窗一致。</p></div></div>
    <div class="example-body demo-row"><a-button @click="dialog.open = true">打开新增使用者</a-button><a-button @click="open(mock.rows[0])">打开修改使用者</a-button><code>open = {{ dialog.open }}</code></div>
  </section>
  <section class="example"><div class="example-head"><div><h3>AppSidebar</h3><p>通知式导航（不依赖 vue-router）：点击链接发出 <code>navigate</code>；248px 展开、72px 图标模式、搜索、快捷键与折叠偏好。</p></div></div>
    <div class="example-body">
      <div style="height:600px;border:1px solid #dde5ed;border-radius:8px;overflow:hidden"><AppSidebar :links="navLinks" :active-path="active" :start-collapsed="false" preference-key="ams.demo.sidebar" @navigate="path => { active = path; notify(`已选择 ${path}（本地导航）`) }"/></div>
      <div class="note" style="margin-top:12px">当前选中：<code>{{ active }}</code>。搜索「子系统」或按 Esc 可验证过滤与清除行为。</div>
    </div>
  </section>
  <RecordDialog v-model:open="dialog.open" :title="dialog.title" wide>
    <FieldForm :fields="mock.masterMeta.fields" :model="dialog.model" :options="mock.options" :editing="true"/>
    <div class="form-actions"><a-button @click="dialog.open = false">取消</a-button><a-button type="primary" @click="dialog.open = false">储存</a-button></div>
  </RecordDialog>
</template>
