<script setup>
/** AMS underlined tab bar, matching the buttons used in MasterPage / AlarmDetail. */
defineProps({ items: { type: Array, default: () => [] }, modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
</script>
<template>
  <div class="tabs" role="tablist">
    <button v-for="item in items" :key="item.key" type="button" role="tab" :aria-selected="modelValue === item.key"
      :class="{ active: modelValue === item.key }" @click="emit('update:modelValue', item.key)">{{ item.label }}</button>
  </div>
</template>
