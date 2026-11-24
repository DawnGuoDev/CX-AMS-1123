<script setup>
import { state, t } from '../state'
const props = defineProps({ fields: Array, model: Object, editing: Boolean })
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
    <label v-for="f in fields.filter(f => !f.readOnly)" :key="f.name" :class="{ wide: ['textarea','sql'].includes(f.type), required: f.required }">
      <span>{{ t(f.label || f.name) }} <b v-if="f.required">*</b></span>
      <select v-if="f.type === 'select'" v-model="model[f.name]" :required="f.required" :disabled="editing && f.readOnlyOnEdit" @change="changed(f)">
        <option value="">{{ t('请选择') }}</option><option v-for="o in options(f)" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <input v-else-if="f.type === 'checkbox'" type="checkbox" v-model="model[f.name]" true-value="Y" false-value="N">
      <textarea v-else-if="['textarea','sql'].includes(f.type)" v-model="model[f.name]" :rows="f.type === 'sql' ? 5 : 3" :required="f.required"></textarea>
      <input v-else v-model="model[f.name]" :type="['number','password','date','datetime-local'].includes(f.type) ? f.type : 'text'" :required="f.required" :disabled="editing && f.readOnlyOnEdit" :step="f.type === 'number' ? 'any' : undefined">
      <small v-if="f.help">{{ t(f.help) }}</small>
    </label>
  </div>
</template>
