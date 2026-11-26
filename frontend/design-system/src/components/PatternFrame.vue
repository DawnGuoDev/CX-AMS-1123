<script setup>
/** Renders a full AMS app shell at 1440px, then uniformly scales it to the gallery width. */
import { onBeforeUnmount, onMounted, ref } from 'vue'
const el = ref(null), scale = ref(1)
let observer
function fit() {
  if (!el.value) return
  scale.value = Math.min(1, el.value.clientWidth / 1440)
}
onMounted(() => {
  fit()
  observer = new ResizeObserver(fit)
  observer.observe(el.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>
<template>
  <div class="pattern-frame"><div ref="el" class="pattern-frame-body">
    <div class="pattern-frame-head"><span>应用壳预览 · 1440px 桌面视口 · 本地数据</span><span>缩放 {{ Math.round(scale * 100) }}%</span></div>
    <div :style="{ height: `${640 * scale}px` }">
      <div class="pattern-canvas" :style="{ transform: `scale(${scale})` }"><slot/></div>
    </div>
    </div>
  </div>
</template>
