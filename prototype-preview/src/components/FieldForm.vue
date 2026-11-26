<script setup>
import UiCheckbox from './UiCheckbox.vue'
import { Input as AInput, Textarea as ATextarea, Select as ASelect } from 'ant-design-vue'
import { state, t } from '../state'
const props = defineProps({ fields: Array, model: Object, editing: Boolean })
const required = f => f.required || (f.requiredOnCreate && !props.editing)
function options(field) {
  if (field.options) return field.options
  if (field.optionSet === 'subsystem' && props.model.FACTORY_KEY) return state.options.subsystemByFactory?.[props.model.FACTORY_KEY] || []
  if (field.optionSet === 'event') return (state.options[field.optionSet] || []).filter(o =>
    (!props.model.FACTORY_KEY || o.factoryKey === props.model.FACTORY_KEY) && (!props.model.SUB_SYS_KEY || o.subsysKey === props.model.SUB_SYS_KEY))
  return state.options[field.optionSet] || []
}
function changed(field) {
  if (field.name === 'FACTORY_KEY') { props.model.SUB_SYS_KEY = ''; props.model.EVENT_KEY = '' }
  if (field.name === 'SUB_SYS_KEY' && props.model.EVENT_KEY) props.model.EVENT_KEY = ''
}
</script>
<template>
  <div class="fields">
    <label v-for="f in fields.filter(f => !f.readOnly)" :key="f.name" :class="{ wide: ['textarea','sql'].includes(f.type), required: required(f) }">
      <span>{{ t(f.label || f.name) }} <b v-if="required(f)">*</b></span>
      <a-select :aria-label="t(f.label || f.name)" v-if="f.type === 'select'" v-model:value="model[f.name]"
        :options="[{ value: '', label: t('请选择') }, ...options(f)]" :disabled="editing && f.readOnlyOnEdit" @change="changed(f)"/>
      <UiCheckbox v-else-if="f.type === 'checkbox'"  v-model="model[f.name]" true-value="Y" false-value="N"/>
      <a-textarea v-else-if="['textarea','sql'].includes(f.type)" v-model:value="model[f.name]" :rows="f.type === 'sql' ? 5 : 3" :required="f.required"></a-textarea>
      <a-input v-else v-model:value="model[f.name]" :type="['number','password','date','datetime-local'].includes(f.type) ? f.type : 'text'" :required="required(f)" :disabled="editing && f.readOnlyOnEdit" :step="f.type === 'number' ? (f.integer ? 1 : 'any') : undefined" :min="f.min" :autocomplete="f.type === 'password' ? 'new-password' : undefined"/>
      <small v-if="f.help">{{ t(f.help) }}</small>
    </label>
  </div>
</template>
