<script setup lang="ts">
import { SearchIcon } from '@lucide/vue';

import type { ListboxFilterProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ListboxFilter, useForwardProps } from "reka-ui"
import { cn } from "@/lib/utils"
import { useCommand } from "."

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<ListboxFilterProps & {
  class?: HTMLAttributes["class"]
}>()

const delegatedProps = reactiveOmit(props, "class")

const forwardedProps = useForwardProps(delegatedProps)

const { filterState } = useCommand()
</script>

<template>
  <div
    data-slot="command-input-wrapper"
    class="p-1 pb-0 relative"
  >
    <div class="relative flex items-center border border-border h-8 bg-surface">
      <SearchIcon class="absolute left-2.5 size-3.5 shrink-0 opacity-50 text-foreground" />
      <ListboxFilter
        v-bind="{ ...forwardedProps, ...$attrs }"
        v-model="filterState.search"
        data-slot="command-input"
        auto-focus
        :class="cn('w-full text-xs pl-8 pr-3 outline-hidden disabled:cursor-not-allowed disabled:opacity-50 border-0 bg-transparent font-mono', props.class)"
      />
    </div>
  </div>
</template>
