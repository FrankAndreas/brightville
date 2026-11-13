<script setup lang="ts">
import { computed } from 'vue'
import { furnitureDef, type FurnitureDef, type Spot } from '@/core/furniture'
import { useRoomStore } from '@/stores/room'

// A tap on a spot in her room (stage 8): the pieces she owns for it, and "nothing". A tap puts one there, free, as
// often as she likes; what stood there stays hers.
const props = defineProps<{ spot: Spot }>()
const emit = defineEmits<{ close: [] }>()
const room = useRoomStore()

const pieces = computed(() =>
  room.owned.map(o => furnitureDef(o.id)).filter((f): f is FurnitureDef => !!f && f.spot === props.spot))

function choose(id: string | null) {
  void room.place(props.spot, id)
  emit('close')
}
</script>

<template>
  <div class="veil" data-test="spot-chooser" @click.self="emit('close')">
    <div class="tray">
      <button
        v-for="f in pieces" :key="f.id" class="piece" data-test="piece" :data-id="f.id"
        :data-placed="room.placed[spot] === f.id" :aria-label="f.name" @click="choose(f.id)"
      >{{ f.emoji }}</button>
      <button class="piece none" data-test="piece-none" aria-label="Nichts" @click="choose(null)">🚫</button>
    </div>
  </div>
</template>

<style scoped>
.veil { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; background: rgb(0 0 0 / 25%); }
.tray {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
  max-width: 80vw;
  padding: 20px 24px;
  border-radius: 24px;
  background: #fff8ee;
  box-shadow: 0 10px 0 rgb(0 0 0 / 12%);
}
.piece {
  width: min(16vw, 16vh, 120px);
  aspect-ratio: 1;
  border: 5px solid white;
  border-radius: 22px;
  background: white;
  font-size: min(9vw, 9vh, 70px);
  box-shadow: 0 5px 0 rgb(0 0 0 / 10%);
  cursor: pointer;
}
.piece[data-placed='true'] { border-color: #4bd37b; background: #e8fbef; }
.none { font-size: min(6vw, 6vh, 46px); }
</style>
