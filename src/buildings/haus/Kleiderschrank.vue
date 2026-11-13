<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CharacterView from '@/components/CharacterView.vue'
import LookScreen from '@/components/LookScreen.vue'
import type { Look } from '@/core/look'
import { PLACES, outfitDef, type OutfitDef, type Place } from '@/core/outfits'
import { instruct } from '@/services/tts'
import { useWardrobeStore } from '@/stores/wardrobe'

// The wardrobe in Mein Haus (stage 7): everything she owns, to put on and take off as often as she likes, and ✏️ to
// change her look. Nothing to buy here.
const wardrobe = useWardrobeStore()
const editing = ref(false)

/** Her add-ons by place, in the order she got them; ids the catalogue no longer has are left out */
const byPlace = computed(() =>
  PLACES.map(place => ({
    place,
    items: wardrobe.owned.map(o => outfitDef(o.id)).filter((o): o is OutfitDef => !!o && o.place === place),
  })).filter(group => group.items.length > 0),
)

function tap(place: Place, o: OutfitDef) {
  const on = wardrobe.worn[place] === o.id
  void wardrobe.wear(place, on ? null : o.id)
}

async function lookChosen(look: Look) {
  editing.value = false
  await wardrobe.saveLook(look)
}

onMounted(() => {
  if (byPlace.value.length === 0) void instruct('Im Kleiderladen kannst du dir etwas aussuchen.')
  else void instruct('Tipp auf etwas, dann ziehst du es an. Nochmal tippen zieht es aus.')
})
</script>

<template>
  <LookScreen v-if="editing" :start="wardrobe.dress.look" cancel @done="lookChosen" @cancel="editing = false" />
  <div v-else class="schrank" data-test="kleiderschrank">
    <div class="mirror">
      <CharacterView :dress="wardrobe.dress" :size="280" />
      <button class="edit" data-test="edit-look" aria-label="Aussehen ändern" @click="editing = true">✏️</button>
    </div>
    <div v-if="byPlace.length" class="rails">
      <div v-for="group in byPlace" :key="group.place" class="rail">
        <button
          v-for="o in group.items" :key="o.id" class="item" data-test="wear" :data-id="o.id"
          :data-worn="wardrobe.worn[group.place] === o.id" :aria-label="o.name" @click="tap(group.place, o)"
        >{{ o.emoji }}</button>
      </div>
    </div>
    <div v-else class="empty" data-test="wardrobe-empty" aria-hidden="true">👗➡️🏪</div>
  </div>
</template>

<style scoped>
.schrank {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  /* With many add-ons (or Safari's bars) it scrolls instead of running under the buttons at the top */
  overflow-y: auto;
  justify-content: center;
  gap: 4vw;
  padding: calc(100px + env(safe-area-inset-top)) 3vw 3vh;
  box-sizing: border-box;
}
.mirror { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.edit {
  width: 72px;
  height: 72px;
  border: 0;
  border-radius: 50%;
  background: white;
  font-size: 34px;
  box-shadow: 0 5px 0 rgb(0 0 0 / 12%);
  cursor: pointer;
}
.rails { display: flex; flex-direction: column; gap: 2.4vh; max-height: 100%; }
.rail { display: flex; flex-wrap: wrap; gap: 1.4vw; padding-bottom: 1.4vh; border-bottom: 8px solid #9c6b3e; }
.item {
  width: min(11vw, 96px);
  aspect-ratio: 1;
  border: 5px solid white;
  border-radius: 18px;
  background: white;
  font-size: min(6vw, 50px);
  box-shadow: 0 4px 0 rgb(0 0 0 / 10%);
  cursor: pointer;
}
.item[data-worn='true'] { border-color: #4bd37b; background: #e8fbef; transform: scale(1.06); }
.empty { font-size: min(10vw, 90px); }
</style>
