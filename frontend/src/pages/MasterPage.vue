<script setup>
import { computed, onMounted, ref } from 'vue'
import { state, api, act, t, clone, notify, refreshOptions, download, historyColumns } from '../state'
import DataGrid from '../components/DataGrid.vue'
import FieldForm from '../components/FieldForm.vue'
import RecordDialog from '../components/RecordDialog.vue'
const props = defineProps({ code: String })
const kind = computed(() => state.meta.masters?.[props.code] ? 'master' : state.meta.mappings?.[props.code] ? 'mapping' : 'masterdetail')
const data = ref({}), showHidden = ref(false), tab = ref('data'), selected = ref([]), edit = ref(null), editing = ref(false), confirm = ref(''), fileInput = ref(null)
const importRows = ref(null), importSelected = ref([]), masterKey = ref(''), itemKeys = ref([]), itemSearch = ref('')
const meta = computed(() => data.value.meta || { fields: [] })
const rows = computed(() => data.value.rows || data.value.masters || [])
const keyField = computed(() => meta.value.keyField || meta.value.masterKey || meta.value.master?.key)
const columns = computed(() => (meta.value.fields || []).filter(f => f.grid !== false && f.type !== 'password').map(f => ({...f,field:f.name})))
const route = computed(() => `/${kind.value}/${props.code}`)
async function load() {
  data.value = await api(`${route.value}?showHidden=${showHidden.value ? 1 : 0}`)
  if (kind.value === 'mapping' && !masterKey.value) chooseMaster(data.value.masters[0])
}
function chooseMaster(row) {
  if (!row) return
  masterKey.value = row[meta.value.master.key]
  itemKeys.value = data.value.mapRows.filter(r => r[meta.value.mapMasterFk] === masterKey.value).map(r => r[meta.value.mapItemFk])
}
function start(row, copy = false) {
  editing.value = !!row && !copy
  edit.value = clone(row || meta.value.defaults || {})
  if (copy) { delete edit.value[keyField.value]; delete edit.value[meta.value.idField || meta.value.masterId] }
  if (kind.value === 'masterdetail') {
    const d = meta.value.detail
    const details = (data.value.details || []).filter(r => r[d.fk] === row?.[keyField.value])
    if (d.mode === 'grid') {
      edit.value.details = clone(details)
      if (copy) edit.value.details.forEach(r => delete r[d.key])
    } else edit.value.detailKeys = details.map(r => r[d.itemKey])
  }
}
function addLevel() { edit.value.details.push({ EVENT_LEVEL_ID: edit.value.details.length + 1, EVENT_LEVEL_DESC: '', NUMBER_OF_ACK_USERS:'1', LEVEL_INTERVAL:10, FAIL_RETRY_TIMES:0, FAIL_RETRY_INTERVAL:60,USER_KEYS:[] }) }
async function save() {
  await act(async () => {
    const url = kind.value === 'master' && editing.value ? `${route.value}/${edit.value[keyField.value]}` : route.value
    await api(url, edit.value, kind.value === 'master' && editing.value ? 'PUT' : 'POST')
    edit.value = null; notify('储存成功'); await refreshOptions(); await load()
  })
}
async function changeActive() {
  await act(async () => {
    for (const row of selected.value) await api(`${route.value}/${row[keyField.value]}/${confirm.value}`, {})
    confirm.value = ''; await refreshOptions(); await load(); notify('储存成功')
  })
}
async function upload(event) {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return
  await act(async () => {
    const buffer = new Uint8Array(await file.arrayBuffer())
    let text=''; for (const byte of buffer) text+=String.fromCharCode(byte)
    importRows.value = (await api(`${route.value}/import/verify`,{base64:btoa(text)})).rows
  })
}
async function importSelectedRows() {
  await act(async () => {
    const result = await api(`${route.value}/import`,{rows:importSelected.value.filter(r => r.valid)})
    notify(`已汇入 ${result.success} 笔`); importRows.value=null
    await refreshOptions(); await load()
    if (result.errors?.length) state.error=result.errors.join('；')
  })
}
onMounted(() => act(load))
</script>
<template>
  <p class="description">{{ t(meta.desc) }}</p>
  <div class="toolbar">
    <template v-if="kind !== 'mapping'">
      <button class="primary" @click="start()">{{ t('新增') }}</button><button :disabled="selected.length !== 1" @click="start(selected[0],true)">{{ t('复制') }}</button>
      <button :disabled="selected.length !== 1" @click="start(selected[0])">{{ t('修改') }}</button>
      <button :disabled="!selected.length" @click="confirm = 'hide'">{{ t('隐藏') }}</button><button :disabled="!selected.length" @click="confirm = 'show'">{{ t('取消隐藏') }}</button>
      <label class="check"><input type="checkbox" v-model="showHidden" @change="act(load)">{{ t('显示已隐藏资料') }}</label>
    </template>
    <button @click="act(load)">{{ t('重新整理') }}</button><span class="spacer"/>
    <template v-if="kind !== 'masterdetail'">
      <button @click="act(async () => download(await api(`${route}/export`,{})))">{{ t('汇出') }}</button>
      <button @click="act(async () => download(await api(`${route}/export`,{mode:'template'})))">{{ t('汇出范本') }}</button>
      <button @click="fileInput.click()">{{ t('汇入') }}</button><input ref="fileInput" type="file" accept=".xlsx" hidden @change="upload">
    </template>
  </div>
  <div class="tabs"><button :class="{active:tab === 'data'}" @click="tab = 'data'">{{ t('资料') }}</button><button :class="{active:tab === 'history'}" @click="tab = 'history'">{{ t('履历') }}</button></div>
  <DataGrid v-if="tab === 'history'" :rows="data.history || []" :columns="historyColumns"/>
  <div v-else-if="kind === 'mapping' && meta.master" class="mapping-layout">
    <section class="panel"><h3>{{ t(meta.master.label) }}</h3><input v-model="itemSearch" :placeholder="t('过滤')">
      <button v-for="row in data.masters.filter(r => meta.master.display.some(k => String(r[k] || '').includes(itemSearch)))" :key="row[meta.master.key]" class="master-choice" :class="{active:masterKey === row[meta.master.key]}" @click="chooseMaster(row)">{{ meta.master.display.slice(0,2).map(k => row[k]).join(' · ') }}</button>
    </section>
    <section class="panel"><h3>{{ t(meta.item.label) }} · {{ itemKeys.length }} {{ t('已选择') }}</h3><div class="transfer-list"><label v-for="item in data.items" :key="item[meta.item.key]" class="check"><input type="checkbox" v-model="itemKeys" :value="item[meta.item.key]">{{ meta.item.display.map(k => item[k]).filter(Boolean).join(' · ') }}</label></div>
      <button class="primary" :disabled="!masterKey" @click="act(async () => { await api(`${route}/${masterKey}`,{itemKeys}); await refreshOptions(); await load(); notify('储存成功') })">{{ t('储存') }}</button>
    </section>
  </div>
  <DataGrid v-else :rows="rows" :columns="[...columns,{field:'ACTIVE',label:'状态'}]" selectable :row-key="keyField" @select="selected = $event" @open="start($event)"/>
  <RecordDialog v-if="edit" :title="editing ? '修改' : '新增'" wide @close="edit = null">
    <form @submit.prevent="save"><FieldForm :fields="meta.fields" :model="edit" :editing="editing"/>
      <template v-if="kind === 'masterdetail'"><h3>{{ t(meta.detail.title) }}</h3>
        <div v-for="(level,index) in edit.details" :key="index" class="level-card"><div class="toolbar"><strong>LEVEL-{{ index+1 }}</strong><button type="button" @click="edit.details.splice(index,1);edit.details.forEach((r,i)=>r.EVENT_LEVEL_ID=i+1)">{{ t('移除') }}</button></div><FieldForm :fields="meta.detail.fields" :model="level"/><h4>本层级通知人员 · Email</h4><div class="transfer-list"><label v-for="u in state.options.user" :key="u.value" class="check"><input type="checkbox" v-model="level.USER_KEYS" :value="u.value">{{ u.label }}</label></div></div><button type="button" @click="addLevel">{{ t('新增层级') }}</button>
      </template>
      <div class="form-actions"><button type="button" @click="edit = null">{{ t('取消') }}</button><button class="primary" :disabled="state.busy > 0">{{ t('储存') }}</button></div>
    </form>
  </RecordDialog>
  <RecordDialog v-if="confirm" title="确认" @close="confirm = ''"><p>{{ t(confirm === 'hide' ? '确认隐藏所选资料？' : '确认取消隐藏所选资料？') }}（{{ selected.length }}）</p><div class="form-actions"><button @click="confirm = ''">{{ t('取消') }}</button><button class="primary" @click="changeActive">{{ t('确定') }}</button></div></RecordDialog>
  <RecordDialog v-if="importRows" title="汇入验证" wide @close="importRows = null"><p>请勾选通过验证的资料。保存时会再次校验。</p><DataGrid :rows="importRows" :columns="[{field:'rowNo',label:'行号'},{field:'valid',label:'可汇入'},{field:'message',label:'验证信息'},{field:'values',label:'资料'}]" selectable @select="importSelected = $event"/><div class="form-actions"><button class="primary" :disabled="!importSelected.some(r => r.valid)" @click="importSelectedRows">{{ t('汇入') }}</button></div></RecordDialog>
</template>
