<script setup>
import { computed, ref } from 'vue'
import { t } from '../state'
const props=defineProps({modelValue:[Object,Array,String,Number,Boolean], template:{type:Object,default:()=>({field:'',label:''})}})
const emit=defineEmits(['update:modelValue'])
const array=computed(()=>Array.isArray(props.modelValue))
const newKey=ref(''),newType=ref('text')
function addProperty() {
  const key=newKey.value.trim()
  if(!key || Object.hasOwn(props.modelValue || {},key) || ['__proto__','prototype','constructor'].includes(key)) return
  replace(key,({text:'',number:0,boolean:false,object:{},array:[]})[newType.value]);newKey.value=''
}
function replace(key,value) {
  const out=array.value?[...props.modelValue]:{...props.modelValue};out[key]=value;emit('update:modelValue',out)
}
function remove(index) {const out=[...props.modelValue];out.splice(index,1);emit('update:modelValue',out)}
function add() {
  const source=props.modelValue[0] ?? props.template
  const value=source!==null && typeof source==='object'?Object.fromEntries(Object.entries(source).map(([k,v])=>[k,typeof v==='boolean'?false:typeof v==='number'?0:Array.isArray(v)?[]:typeof v==='object'?{}:''])):''
  emit('update:modelValue',[...props.modelValue,value])
}
</script>
<template>
  <div class="structure-editor">
    <template v-if="array"><div v-for="(item,index) in modelValue" :key="index" class="structure-item"><div class="toolbar"><strong>#{{ index+1 }}</strong><button type="button" @click="remove(index)">{{ t('移除') }}</button></div>
      <StructureEditor v-if="item !== null && typeof item==='object'" :model-value="item" @update:model-value="replace(index,$event)"/>
      <input v-else :value="item" @input="replace(index,$event.target.value)">
    </div><button type="button" @click="add">{{ t('新增') }}</button></template>
    <div v-else class="fields"><label v-for="(value,key) in modelValue" :key="key" :class="{wide: value!==null && typeof value==='object'}"><span>{{ t(key) }}</span>
      <StructureEditor v-if="value!==null && typeof value==='object'" :model-value="value" @update:model-value="replace(key,$event)"/>
      <input v-else-if="typeof value==='boolean'" type="checkbox" :checked="value" @change="replace(key,$event.target.checked)">
      <textarea v-else-if="String(value||'').length>100 || /SQL/.test(key)" :value="value" @input="replace(key,$event.target.value)" rows="3"/>
      <input v-else :type="typeof value==='number'?'number':'text'" :value="value" @input="replace(key,typeof value==='number'?Number($event.target.value):$event.target.value)">
    </label></div>
    <div v-if="!array" class="toolbar"><input v-model="newKey" placeholder="新增属性名称" aria-label="新增属性名称"><select v-model="newType" aria-label="属性类型"><option value="text">文字</option><option value="number">数字</option><option value="boolean">开关</option><option value="object">对象</option><option value="array">列表</option></select><button type="button" :disabled="!newKey.trim()" @click="addProperty">新增属性</button></div>
  </div>
</template>
