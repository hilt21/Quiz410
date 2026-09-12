<script setup lang="ts">
import type { Material } from '../types/quiz';
defineProps<{ blocks: Material[] }>();
</script>
<template>
  <div class="material-content">
    <template v-for="(block, index) in blocks" :key="index">
      <p v-if="block.type === 'text'">{{ block.text }}</p>
      <div
        v-else
        class="table-scroll"
        tabindex="0"
        role="region"
        aria-label="实验数据表，可横向滚动"
      >
        <table>
          <caption class="sr-only">
            实验数据
          </caption>
          <thead>
            <tr>
              <th v-for="(header, i) in block.headers" :key="i" scope="col">{{ header }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in block.rows" :key="i">
              <td v-for="(cell, j) in row" :key="j">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
