<script setup>
/**
 * Metadata-driven AMS field form (2-column). Used by 主档编辑 and dialog bodies.
 * `options` is passed in explicitly; the component never reads a global store.
 */
import UiCheckbox from './UiCheckbox.vue'

const props = defineProps({
  fields: { type: Array, default: () => [] },
  model: { type: Object, required: true },
  editing: Boolean,
  options: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['change'])
const required = f => f.required || (f.requiredOnCreate && !props.editing)
const visible = f => !f.hidden
function choices(field) {
  if (field.options) return field.options
  return props.options[field.optionSet] || []
}
function changed(field, value) {
  if (field.name === 'FACTORY_KEY') { props.model.SUB_SYS_KEY = ''; props.model.EVENT_KEY = '' }
  if (field.name === 'SUB_SYS_KEY' && props.model.EVENT_KEY) props.model.EVENT_KEY = ''
  emit('change', { field: field.name, value })
}
</script>
<template>
  <div class="fields">
    <label v-for="f in fields.filter(visible)" :key="f.name" :class="{ wide: ['textarea', 'sql'].includes(f.type), required: required(f) }">
      <span>{{ f.label || f.name }} <b v-if="required(f)">*</b></span>
      <a-select v-if="f.type === 'select'" :aria-label="f.label || f.name" :value="model[f.name]"
        :options="[{ value: '', label: '请选择' }, ...choices(f)]" :disabled="(editing && f.readOnlyOnEdit) || f.disabled"
        @change="value => { model[f.name] = value; changed(f, value) }"/>
      <UiCheckbox v-else-if="f.type === 'checkbox'" :model-value="model[f.name]" true-value="Y" false-value="N" :disabled="f.disabled"
        @update:model-value="value => { model[f.name] = value; changed(f, value) }"/>
      <a-textarea v-else-if="['textarea', 'sql'].includes(f.type)" :value="model[f.name]" :rows="f.type === 'sql' ? 5 : 3"
        :disabled="(editing && f.readOnlyOnEdit) || f.disabled" @update:value="value => { model[f.name] = value; changed(f, value) }"/>
      <a-input v-else :value="model[f.name]" :type="['number', 'password', 'date', 'datetime-local'].includes(f.type) ? f.type : 'text'"
        :disabled="(editing && f.readOnlyOnEdit) || f.disabled" :step="f.type === 'number' ? (f.integer ? 1 : 'any') : undefined"
        :min="f.min" :autocomplete="f.type === 'password' ? 'new-password' : undefined"
        @update:value="value => { model[f.name] = value; changed(f, value) }"/>
      <small v-if="f.help">{{ f.help }}</small>
    </label>
  </div>
</template>
