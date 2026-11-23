<script setup>
import { t } from '../state'
defineProps({ title: String, wide: Boolean })
defineEmits(['close'])
</script>
<template>
  <Teleport to="body"><div class="overlay" @click.self="$emit('close')">
    <section class="dialog" :class="{ large: wide }" role="dialog" aria-modal="true" :aria-label="title" @keydown.esc="$emit('close')" tabindex="-1">
      <header><h2>{{ t(title) }}</h2><button @click="$emit('close')" aria-label="关闭">×</button></header>
      <div class="dialog-body"><slot/></div>
    </section>
  </div></Teleport>
</template>
