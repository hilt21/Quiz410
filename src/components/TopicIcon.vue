<script setup lang="ts">
import {
  PhPaperPlaneTilt,
  PhLightbulb,
  PhMagnet,
  PhFlask,
  PhWaveform,
  PhPlant,
  PhPlanet,
  PhThermometer,
} from '@phosphor-icons/vue';
const icons: Record<string, unknown> = {
  motion: PhPaperPlaneTilt,
  light: PhLightbulb,
  electricity: PhMagnet,
  experiment: PhFlask,
  sound: PhWaveform,
  life: PhPlant,
  earth: PhPlanet,
  heat: PhThermometer,
};
defineProps<{ name: string }>();
</script>
<template>
  <component :is="icons[name] || PhFlask" :size="64" weight="duotone" aria-hidden="true" />
</template>
