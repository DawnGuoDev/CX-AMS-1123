<script setup>
/**
 * AMS checkbox: adapts the API's Y/N flags and recipient arrays at the UI boundary.
 * Input is a prop (not global state), so the gallery can run with local fixtures only.
 */
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [Boolean, String, Array], default: false },
  value: { type: [String, Number], default: undefined },
  trueValue: { type: [Boolean, String, Number], default: true },
  falseValue: { type: [Boolean, String, Number], default: false },
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue', 'change'])
const checked = computed(() => Array.isArray(props.modelValue)
  ? props.modelValue.includes(props.value)
  : props.modelValue === props.trueValue)
function change(event) {
  const on = event.target.checked
  const next = Array.isArray(props.modelValue)
    ? on ? [...new Set([...props.modelValue, props.value])] : props.modelValue.filter(value => value !== props.value)
    : on ? props.trueValue : props.falseValue
  emit('update:modelValue', next)
  emit('change', event)
}
</script>
<template>
  <a-checkbox :checked="checked" :disabled="disabled" @change="change"><slot/></a-checkbox>
</template>
