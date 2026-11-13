<template>
  <!-- Her wardrobe, drawn as a piece of furniture: two doors, round handles, a crown on top -->
  <svg class="schrank" viewBox="0 0 120 220" aria-hidden="true">
    <path d="M14 18 Q60 0 106 18 V26 H14 Z" class="crown" />
    <rect x="10" y="24" width="100" height="184" rx="8" class="body" />
    <rect x="18" y="32" width="40" height="164" rx="5" class="door" />
    <rect x="62" y="32" width="40" height="164" rx="5" class="door" />
    <path d="M24 46 Q38 40 52 46 M68 46 Q82 40 96 46" class="carve" />
    <circle cx="52" cy="114" r="4" class="knob" />
    <circle cx="68" cy="114" r="4" class="knob" />
    <rect x="16" y="208" width="14" height="10" rx="3" class="foot" />
    <rect x="90" y="208" width="14" height="10" rx="3" class="foot" />
  </svg>
</template>

<style scoped>
.schrank { width: 100%; height: 100%; display: block; filter: drop-shadow(0 6px 0 rgb(0 0 0 / 12%)); }
.crown { fill: #b5824f; }
.body { fill: #c8935b; stroke: #8a5a2e; stroke-width: 3; }
.door { fill: #dba86f; stroke: #8a5a2e; stroke-width: 2; }
.carve { fill: none; stroke: #8a5a2e; stroke-width: 2; stroke-linecap: round; }
.knob { fill: #f2c94c; stroke: #8a5a2e; stroke-width: 1.5; }
.foot { fill: #8a5a2e; }
</style>
