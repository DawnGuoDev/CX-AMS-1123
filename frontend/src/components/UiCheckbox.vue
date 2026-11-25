<script setup>
import { computed } from 'vue'
import { Checkbox as ACheckbox } from 'ant-design-vue'
// Preserve the API's Y/N flags and recipient arrays at the UI boundary.
const props = defineProps({ modelValue: [Boolean, String, Array], value: [String, Number], trueValue: { default: true }, falseValue: { default: false } })
const emit = defineEmits(['update:modelValue', 'change'])
const checked = computed(() => Array.isArray(props.modelValue) ? props.modelValue.includes(props.value) : props.modelValue === props.trueValue)
function change(event) {
  const on = event.target.checked
  const next = Array.isArray(props.modelValue)
    ? on ? [...new Set([...props.modelValue, props.value])] : props.modelValue.filter(value => value !== props.value)
    : on ? props.trueValue : props.falseValue
  emit('update:modelValue', next)
  emit('change', event)
}
</script>
<template><a-checkbox :checked="checked" @change="change"><slot/></a-checkbox></template>
