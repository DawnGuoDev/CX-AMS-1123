<script setup>
import UiCheckbox from '../components/UiCheckbox.vue'
import { Button as AButton, Input as AInput, Select as ASelect, SelectOption as ASelectOption } from 'ant-design-vue'
import { computed, onMounted, ref } from 'vue'
import { state, api, act, t, clone, notify, refreshOptions, download, historyColumns } from '../state'
import DataGrid from '../components/DataGrid.vue'
import FieldForm from '../components/FieldForm.vue'
import RecordDialog from '../components/RecordDialog.vue'
const props = defineProps({ code: String })
const kind = computed(() => state.meta.masters?.[props.code] ? 'master' : state.meta.mappings?.[props.code] ? 'mapping' : 'masterdetail')
const data = ref({}), showHidden = ref(false), tab = ref('data'), selected = ref([]), edit = ref(null), editing = ref(false), confirm = ref(''), fileInput = ref(null)
const importRows = ref(null), importSelected = ref([]), masterKey = ref(''), itemKeys = ref([]), itemSearch = ref('')
const editorTab=ref('main'),levelDraft=ref(null),levelIndex=ref(-1)
const mapEdit=ref(null),mapCopy=ref(false),availableSelected=ref([]),assignedSelected=ref([])
const meta = computed(() => data.value.meta || { fields: [] })
const rows = computed(() => data.value.rows || data.value.masters || [])
const keyField = computed(() => meta.value.keyField || meta.value.masterKey || meta.value.master?.key)
const auditColumns=[{field:'MTR_DATE',label:'修改时间',type:'date'},{field:'MTR_USER_ID',label:'修改人员代码'},{field:'MTR_USER_NAME',label:'修改人员名称'}]
const columns = computed(() => {
  const fields=(meta.value.fields || []).filter(f => f.grid !== false && f.type !== 'password').map(f => ({...f,field:f.name}))
  if(props.code==='AVMA009') {
    for(const [field,label] of [['FACTORY_ID','厂别代码'],['FACTORY_NAME','厂别名称'],['SUB_SYS_ID','子系统代码'],['SUB_SYS_NAME','子系统名称'],['EQP_ID','机台代码'],['EQP_NAME','机台名称'],['EVENT_ID','事件通知代码'],['EVENT_NAME','事件通知名称']])
      fields.push({field,label})
  }
  return [...fields,...auditColumns]
})
const levelColumns=computed(()=>[...(meta.value.detail?.fields||[]).map(f=>({...f,field:f.name})),{field:'RECIPIENTS',label:'通知人员'}])
const withRecipients=levels=>levels.map(r=>({...r,RECIPIENTS:(r.USER_KEYS||[]).map(k=>state.options.user?.find(u=>u.value===k)?.label||k).join('；')}))
const selectedDetails=computed(()=>withRecipients((data.value.details||[]).filter(r=>r.EVENT_KEY===selected.value[0]?.EVENT_KEY)))
const assigned=computed(()=>(data.value.items||[]).filter(r=>itemKeys.value.includes(r[meta.value.item?.key])))
const mappingColumns=computed(()=>(meta.value.item?.display||[]).map(field=>({field,label:field})))
const masterLabel=computed(()=>meta.value.master?.label || '')
const itemLabel=computed(()=>meta.value.item?.label || '')
const route = computed(() => `/${kind.value}/${props.code}`)
async function load() {
  data.value = await api(`${route.value}?showHidden=${showHidden.value ? 1 : 0}`)
  selected.value=[]
  if (kind.value === 'mapping') chooseMaster(data.value.masters.find(r=>r[meta.value.master.key]===masterKey.value)||data.value.masters[0])
}
function chooseMaster(row) {
  if (!row) return
  masterKey.value = row[meta.value.master.key]
  itemKeys.value = data.value.mapRows.filter(r => r[meta.value.mapMasterFk] === masterKey.value).map(r => r[meta.value.mapItemFk])
}
function start(row, copy = false) {
  editorTab.value='main';levelDraft.value=null
  editing.value = !!row && !copy
  edit.value = clone(row || meta.value.defaults || {})
  delete edit.value.PASSWORD
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
function addLevel(row) {
  levelIndex.value=row ? edit.value.details.findIndex(r=>Number(r.EVENT_LEVEL_ID)===Number(row.EVENT_LEVEL_ID)) : -1
  levelDraft.value=row ? clone(edit.value.details[levelIndex.value]) : { EVENT_LEVEL_ID: Math.max(0,...edit.value.details.map(r=>Number(r.EVENT_LEVEL_ID)))+1, EVENT_LEVEL_DESC:'',NUMBER_OF_ACK_USERS:'1',LEVEL_INTERVAL:10,FAIL_RETRY_TIMES:0,FAIL_RETRY_INTERVAL:60,USER_KEYS:[] }
}
function confirmLevel() {
  const l=levelDraft.value
  for(const f of meta.value.detail.fields) {
    if(f.required&&(l[f.name]===null||String(l[f.name]??'').trim()==='')){state.error=`${f.label}为必填`;return}
    if(f.integer&&(!Number.isInteger(Number(l[f.name]))||Number(l[f.name])<f.min)){state.error=`${f.label}必须为不小于 ${f.min} 的整数`;return}
  }
  if(!l.USER_KEYS?.length){state.error='每层至少选择一位通知人员';return}
  if(l.NUMBER_OF_ACK_USERS!=='*'&&(!/^\d+$/.test(String(l.NUMBER_OF_ACK_USERS))||Number(l.NUMBER_OF_ACK_USERS)>l.USER_KEYS.length)){state.error='回应人数必须为 * 或不超过通知人数的非负整数';return}
  if(Number(l.FAIL_RETRY_TIMES)>0&&Number(l.FAIL_RETRY_INTERVAL)<=0){state.error='失败重送时间间隔必须大于 0';return}
  if(edit.value.details.some((r,i)=>i!==levelIndex.value&&Number(r.EVENT_LEVEL_ID)===Number(l.EVENT_LEVEL_ID))){state.error='事件层级代码不可重复';return}
  if(levelIndex.value<0)edit.value.details.push(clone(l));else edit.value.details[levelIndex.value]=clone(l)
  edit.value.details.sort((a,b)=>Number(a.EVENT_LEVEL_ID)-Number(b.EVENT_LEVEL_ID))
  levelDraft.value=null;state.error=''
}
function startMapping(copy=false) {
  mapCopy.value=copy;mapEdit.value={masterKey:copy?'':masterKey.value,itemKeys:clone(itemKeys.value)}
  availableSelected.value=[];assignedSelected.value=[]
}
function transfer(add) {
  mapEdit.value.itemKeys=add?[...new Set([...mapEdit.value.itemKeys,...availableSelected.value])]:mapEdit.value.itemKeys.filter(k=>!assignedSelected.value.includes(k))
  availableSelected.value=[];assignedSelected.value=[]
}
async function saveMapping() {
  await act(async()=>{await api(`${route.value}/${mapEdit.value.masterKey}`,{itemKeys:mapEdit.value.itemKeys})
    masterKey.value=mapEdit.value.masterKey;mapEdit.value=null;await refreshOptions();await load();notify('储存成功')})
}
async function save() {
  if(levelDraft.value){state.error='请先确认或取消正在编辑的层级';return}
  for (const field of meta.value.fields || []) {
    if (!field.readOnly && !(editing.value && field.readOnlyOnEdit) && (field.required || (field.requiredOnCreate && !editing.value)) && String(edit.value[field.name] ?? '').trim() === '') {
      state.error = `${t(field.label || field.name)}为必填`; return
    }
  }
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
// Exposed for the page-level unit test (script setup bindings are not part of the public API).
defineExpose({ load, start, save, changeActive, edit, editing, selected, confirm, levelDraft, mapEdit, mapCopy, startMapping, saveMapping })
</script>
<template>
  <p class="description">{{ t(meta.desc) }}</p>
  <div class="toolbar">
    <template v-if="kind !== 'mapping'">
      <a-button class="primary" @click="start()" type="primary" html-type="button">{{ t('新增') }}</a-button><a-button :disabled="selected.length !== 1" @click="start(selected[0],true)" type="default" html-type="button">{{ t('复制') }}</a-button>
      <a-button :disabled="selected.length !== 1" @click="start(selected[0])" type="default" html-type="button">{{ t('修改') }}</a-button>
      <a-button :disabled="!selected.length" @click="confirm = 'hide'" type="default" html-type="button">{{ t('隐藏') }}</a-button><a-button :disabled="!selected.length" @click="confirm = 'show'" type="default" html-type="button">{{ t('取消隐藏') }}</a-button>
      <label class="check"><UiCheckbox  v-model="showHidden" @change="act(load)"/>{{ t('显示已隐藏资料') }}</label>
    </template>
    <template v-else><a-button :disabled="!masterKey" @click="startMapping(true)" type="default" html-type="button">复制</a-button><a-button :disabled="!masterKey" @click="startMapping()" type="default" html-type="button">修改</a-button></template>
    <a-button @click="act(load)" type="default" html-type="button">{{ t('重新整理') }}</a-button><span class="spacer"/>
    <template v-if="kind !== 'masterdetail'">
      <a-button @click="act(async () => download(await api(`${route}/export`,{})))" type="default" html-type="button">{{ t('汇出') }}</a-button>
      <a-button @click="act(async () => download(await api(`${route}/export`,{mode:'template'})))" type="default" html-type="button">{{ t('汇出范本') }}</a-button>
      <a-button @click="fileInput.click()" type="default" html-type="button">{{ t('汇入') }}</a-button><input ref="fileInput" type="file" accept=".xlsx" hidden @change="upload">
    </template>
  </div>
  <div class="tabs"><a-button :class="{active:tab === 'data'}" @click="tab = 'data'" type="default" html-type="button">{{ t('资料') }}</a-button><a-button :class="{active:tab === 'history'}" @click="tab = 'history'" type="default" html-type="button">{{ t('履历') }}</a-button></div>
  <DataGrid v-if="tab === 'history'" :rows="data.history || []" :columns="historyColumns"/>
  <div v-else-if="kind === 'mapping' && meta.master" class="mapping-layout">
    <section class="panel"><h3>{{ t(meta.master.label) }}</h3><a-input v-model:value="itemSearch" :placeholder="t('过滤')"/>
      <a-button v-for="row in data.masters.filter(r => meta.master.display.some(k => String(r[k] || '').includes(itemSearch)))" :key="row[meta.master.key]" class="master-choice" :class="{active:masterKey === row[meta.master.key]}" @click="chooseMaster(row)" type="default" html-type="button">{{ meta.master.display.slice(0,2).map(k => row[k]).join(' · ') }}</a-button>
    </section>
    <section class="panel"><h3>已对应{{ itemLabel }} · {{ itemKeys.length }}</h3>
      <DataGrid :rows="assigned" :columns="mappingColumns"/>
    </section>
  </div>
  <template v-else>
    <DataGrid :rows="rows" :columns="[...columns,{field:'ACTIVE',label:'状态'}]" selectable :row-key="keyField" @select="selected = $event" @open="kind==='masterdetail' ? selected=[$event] : start($event)"/>
    <section v-if="kind==='masterdetail'" class="panel"><h3>事件层级清单 <span v-if="selected.length">{{selected[0].EVENT_ID}}</span></h3>
      <p v-if="!selected.length" class="muted">请选择事件查看层级。</p><DataGrid :rows="selectedDetails" :columns="levelColumns"/>
    </section>
  </template>
  <RecordDialog v-if="edit" :title="editing ? '修改' : '新增'" wide @close="edit = null">
    <div v-if="kind==='masterdetail'" class="tabs"><a-button :class="{active:editorTab==='main'}" @click="editorTab='main'" type="default" html-type="button">主要资讯</a-button><a-button :class="{active:editorTab==='details'}" @click="editorTab='details'" type="default" html-type="button">清单资讯</a-button></div>
    <form @submit.prevent="save"><FieldForm v-if="editorTab==='main'" :fields="meta.fields" :model="edit" :editing="editing"/>
      <template v-if="kind === 'masterdetail'&&editorTab==='details'">
        <p class="muted">层级确认后加入暂存清单；最终储存才生效。取消会丢弃本次修改。</p>
        <DataGrid :rows="withRecipients(edit.details)" :columns="levelColumns" @open="addLevel">
          <template #actions="{row}"><a-button @click="edit.details=edit.details.filter(r=>Number(r.EVENT_LEVEL_ID)!==Number(row.EVENT_LEVEL_ID))" type="default" html-type="button">删除</a-button></template>
        </DataGrid>
        <a-button :disabled="!!levelDraft" @click="addLevel()" type="default" html-type="button">新增层级</a-button>
        <div v-if="levelDraft" class="level-card">
          <FieldForm :fields="meta.detail.fields" :model="levelDraft"/>
          <h4>本层级通知人员 · Email</h4><div class="transfer-list"><label v-for="u in state.options.user" :key="u.value" class="check"><UiCheckbox  v-model="levelDraft.USER_KEYS" :value="u.value"/>{{u.label}}</label></div>
          <div class="toolbar"><a-button @click="levelDraft=null" type="default" html-type="button">取消层级编辑</a-button><a-button class="primary" @click="confirmLevel" type="primary" html-type="button">确认层级</a-button></div>
        </div>
      </template>
      <div class="form-actions"><a-button @click="edit = null" type="default" html-type="button">{{ t('取消') }}</a-button><a-button class="primary" :disabled="state.busy > 0" type="primary" html-type="submit">{{ t('储存') }}</a-button></div>
    </form>
  </RecordDialog>
  <RecordDialog v-if="mapEdit" :title="mapCopy?'复制对应':'修改对应'" wide @close="mapEdit=null">
    <form @submit.prevent="saveMapping">
      <label>{{ masterLabel }} <a-select v-model:value="mapEdit.masterKey" :disabled="!mapCopy" required><a-select-option value="">请选择目标{{ masterLabel }}</a-select-option><a-select-option v-for="r in data.masters" :key="r[meta.master.key]" :value="r[meta.master.key]">{{meta.master.display.map(k=>r[k]).join(' · ')}}</a-select-option></a-select></label>
      <p class="muted">储存将以右侧清单替换所选{{ masterLabel }}的对应；取消不保存。</p>
      <div class="mapping-layout">
        <section class="panel"><h3>未对应{{ itemLabel }}</h3><div class="transfer-list"><label v-for="item in data.items.filter(r=>!mapEdit.itemKeys.includes(r[meta.item.key]))" :key="item[meta.item.key]" class="check"><UiCheckbox  v-model="availableSelected" :value="item[meta.item.key]"/>{{meta.item.display.map(k=>item[k]).join(' · ')}}</label></div><a-button :disabled="!availableSelected.length" @click="transfer(true)" type="default" html-type="button">加入 →</a-button></section>
        <section class="panel"><h3>已对应{{ itemLabel }}</h3><div class="transfer-list"><label v-for="item in data.items.filter(r=>mapEdit.itemKeys.includes(r[meta.item.key]))" :key="item[meta.item.key]" class="check"><UiCheckbox  v-model="assignedSelected" :value="item[meta.item.key]"/>{{meta.item.display.map(k=>item[k]).join(' · ')}}</label></div><a-button :disabled="!assignedSelected.length" @click="transfer(false)" type="default" html-type="button">← 移除</a-button></section>
      </div>
      <div class="form-actions"><a-button @click="mapEdit=null" type="default" html-type="button">取消</a-button><a-button class="primary" :disabled="!mapEdit.masterKey" type="primary" html-type="submit">储存</a-button></div>
    </form>
  </RecordDialog>
  <RecordDialog v-if="confirm" :title="confirm === 'hide' ? '确认隐藏所选资料？' : '确认取消隐藏所选资料？'" @close="confirm = ''"><p>{{ t('确认') }}（{{ selected.length }}）</p><div class="form-actions"><a-button @click="confirm = ''" type="default" html-type="button">{{ t('取消') }}</a-button><a-button class="primary" @click="changeActive" type="primary" html-type="button">{{ t('确定') }}</a-button></div></RecordDialog>
  <RecordDialog v-if="importRows" title="汇入验证" wide @close="importRows = null"><p>请勾选通过验证的资料。保存时会再次校验。</p><DataGrid :rows="importRows" :columns="[{field:'rowNo',label:'行号'},{field:'valid',label:'可汇入'},{field:'message',label:'验证信息'},{field:'values',label:'资料'}]" selectable @select="importSelected = $event"/><div class="form-actions"><a-button class="primary" :disabled="!importSelected.some(r => r.valid)" @click="importSelectedRows" type="primary" html-type="button">{{ t('汇入') }}</a-button></div></RecordDialog>
</template>
