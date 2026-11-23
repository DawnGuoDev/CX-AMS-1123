<script setup>
import { computed,onMounted,ref } from 'vue'
import { state,api,act,t,clone,notify,historyColumns,downloadJson } from '../state'
import { configurations } from '../configuration'
import DataGrid from '../components/DataGrid.vue'
import FieldForm from '../components/FieldForm.vue'
import RecordDialog from '../components/RecordDialog.vue'
import StructureEditor from '../components/StructureEditor.vue'
const props=defineProps({code:String})
const config=computed(()=>configurations[props.code])
const data=ref({rows:[]}),selected=ref([]),edit=ref(null),editing=ref(false),step=ref(0),tab=ref('data'),hidden=ref(false),confirm=ref(''),sqlResult=ref(null),file=ref(null)
const cols=computed(()=>config.value.fields.filter(f=>!['json','sql','textarea','checkbox'].includes(f.type)).slice(0,8).map(f=>({...f,field:f.name})))
const stepFields=computed(()=>config.value.fields.filter(f=>(f.step||0)===step.value))
async function load(){data.value=await api(`/${config.value.endpoint}?showHidden=${hidden.value?1:0}&type=${config.value.type||''}`)}
function start(row,copy=false) {
  edit.value=clone(row||{});editing.value=!!row&&!copy;step.value=0
  if(copy) delete edit.value[config.value.key]
  if(config.value.type)edit.value.BRM_TYPE=config.value.type
  for(const f of config.value.fields.filter(f=>f.type==='json')) edit.value[f.name]=typeof edit.value[f.name]==='string'?JSON.parse(edit.value[f.name]||'[]'):edit.value[f.name]||(['DISPLAY_JSON'].includes(f.name)?{displayType:'Grid',pageSizes:'20,50,100',exportType:'Excel'}:[])
  if(props.code==='RPTSET001'){
    edit.value.ADVANCED_JSON=typeof edit.value.ADVANCED_JSON==='string'?JSON.parse(edit.value.ADVANCED_JSON):edit.value.ADVANCED_JSON||{}
    for(const name of config.value.steps) if(!edit.value.ADVANCED_JSON[name]) edit.value.ADVANCED_JSON[name]={enabled:false,name:'',field:'',expression:''}
  }
}
async function save(){await api(`/${config.value.endpoint}`,edit.value);edit.value=null;notify('储存成功');await load()}
async function changeActive(){
  for(const row of selected.value)await api(`/${config.value.endpoint}/${row[config.value.key]}/${confirm.value}`,{})
  confirm.value='';await load();notify('储存成功')
}
async function testSql(){
  const field=stepFields.value.find(f=>f.type==='sql')||config.value.fields.find(f=>f.type==='sql')
  sqlResult.value=await api('/sql/test',{sql:edit.value[field.name]})
}
async function importConfig(event){
  const source=event.target.files[0];event.target.value='';if(!source)return
  await act(async()=>{
    const values=JSON.parse(await source.text());if(!Array.isArray(values))throw new Error('导入资料必须为数组')
    let success=0;const errors=[]
    for(const value of values){try{await api(`/${config.value.endpoint}`,value);success++}catch(e){errors.push(e.message)}}
    await load();notify(`已汇入 ${success} 笔`);if(errors.length)state.error=errors.join('；')
  })
}
onMounted(()=>act(load))
</script>
<template>
  <p class="description">{{ t(config.description) }}</p>
  <div class="toolbar"><button class="primary" @click="start()">{{ t('新增') }}</button><button :disabled="selected.length!==1" @click="start(selected[0],true)">{{ t('复制') }}</button><button :disabled="selected.length!==1" @click="start(selected[0])">{{ t('修改') }}</button><button :disabled="!selected.length" @click="confirm='hide'">{{ t('隐藏') }}</button><button :disabled="!selected.length" @click="confirm='show'">{{ t('取消隐藏') }}</button><button @click="act(load)">{{ t('重新整理') }}</button><label class="check"><input v-model="hidden" type="checkbox" @change="act(load)">{{ t('显示已隐藏资料') }}</label><span class="spacer"/><button @click="downloadJson(data.rows,`${code}.json`)">{{ t('汇出') }} JSON</button><button @click="file.click()">{{ t('汇入') }} JSON</button><input type="file" ref="file" hidden accept=".json" @change="importConfig"/>
  <button v-if="code==='CVMA015'" @click="act(async()=>{await api('/auto-status/scan',{});await load();notify('扫描完成')})">{{ t('立即扫描') }}</button></div>
  <div class="tabs"><button :class="{active:tab==='data'}" @click="tab='data'">{{ t('资料') }}</button><button :class="{active:tab==='history'}" @click="tab='history'">{{ t('履历') }}</button><button v-if="code==='CVMA015'" @click="tab='logs'">{{ t('扫描日志') }}</button></div>
  <DataGrid v-if="tab==='data'" :rows="data.rows" :columns="[...cols,{field:'ACTIVE',label:'状态'}]" selectable @select="selected=$event" @open="start($event)"/>
  <DataGrid v-else-if="tab==='history'" :rows="data.history" :columns="historyColumns"/>
  <DataGrid v-else :rows="data.logs"/>
  <RecordDialog v-if="edit" :title="editing?'修改':'新增'" wide @close="edit=null"><form @submit.prevent="act(save)">
    <div class="steps"><button v-for="(label,index) in config.steps" :key="index" type="button" :class="{active:step===index}" @click="step=index">{{ index+1 }}. {{ t(label) }}</button></div>
    <FieldForm :fields="stepFields.filter(f=>f.type!=='json')" :model="edit" :editing="editing"/>
    <template v-for="f in stepFields.filter(f=>f.type==='json')" :key="f.name"><h3>{{ t(f.label) }}</h3><StructureEditor v-model="edit[f.name]"/></template>
    <template v-if="code==='RPTSET001' && ![0,1,2,4,5].includes(step)"><h3>{{ t(config.steps[step]) }}</h3><StructureEditor v-model="edit.ADVANCED_JSON[config.steps[step]]"/></template>
    <button v-if="stepFields.some(f=>f.type==='sql')" type="button" @click="act(testSql)">{{ t('测试 SQL') }}</button>
    <div class="form-actions"><button type="button" :disabled="step===0" @click="step--">{{ t('上一步') }}</button><button type="button" :disabled="step>=config.steps.length-1" @click="step++">{{ t('下一步') }}</button><button class="primary" :disabled="state.busy>0">{{ t('储存') }}</button></div>
  </form></RecordDialog>
  <RecordDialog v-if="confirm" title="确认" @close="confirm=''"><p>确认{{ confirm==='hide'?'隐藏':'取消隐藏' }} {{ selected.length }} 笔资料？</p><button class="primary" @click="act(changeActive)">{{ t('确定') }}</button></RecordDialog>
  <RecordDialog v-if="sqlResult" title="SQL 测试" wide @close="sqlResult=null"><p class="warning">{{ sqlResult.message }}</p><DataGrid :rows="sqlResult.rows" :columns="sqlResult.fields.map(f=>({field:f.name,label:f.label}))"/></RecordDialog>
</template>
